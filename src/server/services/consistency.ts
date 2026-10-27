import { eq, sql } from "drizzle-orm";
import { attributeLedger, auditEvent, playerAttribute, playerProgress, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { ATTRIBUTES, LIMITS, type Attribute, type RankId } from "@/lib/progression/config";
import { levelFromXp, rankForLevel } from "@/lib/progression/levels";

// The ledgers are the source of truth; player_progress and player_attribute are caches.
// These functions detect and repair drift between them.

export type ConsistencyReport = {
  userId: string;
  ok: boolean;
  ledgerXp: number;
  cachedXp: number;
  expectedLevel: number;
  cachedLevel: number;
  expectedRank: RankId;
  cachedRank: RankId;
  expectedSkillPoints: number;
  cachedSkillPoints: number;
  attributeMismatches: { attribute: Attribute; ledger: number; cached: number }[];
};

async function ledgerTotals(db: AppDb, userId: string) {
  const [[xp], attrRows] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
      .from(xpLedger)
      .where(eq(xpLedger.userId, userId)),
    db
      .select({
        attribute: attributeLedger.attribute,
        total: sql<number>`coalesce(sum(${attributeLedger.amount}), 0)::int`,
      })
      .from(attributeLedger)
      .where(eq(attributeLedger.userId, userId))
      .groupBy(attributeLedger.attribute),
  ]);
  const attrs = Object.fromEntries(attrRows.map((r) => [r.attribute, r.total])) as Partial<Record<Attribute, number>>;
  return { xp: xp.total, attrs };
}

export async function checkProgressConsistency(db: AppDb, userId: string): Promise<ConsistencyReport> {
  const [totals, progress, attributes] = await Promise.all([
    ledgerTotals(db, userId),
    db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) }),
    db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) }),
  ]);
  if (!progress) throw new Error(`No progress row for player ${userId}`);

  const expectedLevel = levelFromXp(Math.max(0, totals.xp));
  const expectedRank = rankForLevel(expectedLevel).id;
  // Skill points come only from levels for now; achievement grants will add to this.
  const expectedSkillPoints = (expectedLevel - 1) * LIMITS.skillPointsPerLevel;
  const cached = Object.fromEntries(attributes.map((a) => [a.attribute, a.points]));
  const attributeMismatches = ATTRIBUTES.map((attribute) => ({
    attribute,
    ledger: totals.attrs[attribute] ?? 0,
    cached: cached[attribute] ?? 0,
  })).filter((a) => a.ledger !== a.cached);

  const report = {
    userId,
    ledgerXp: totals.xp,
    cachedXp: progress.totalXp,
    expectedLevel,
    cachedLevel: progress.level,
    expectedRank,
    cachedRank: progress.rank,
    expectedSkillPoints,
    cachedSkillPoints: progress.skillPointsEarned,
    attributeMismatches,
  };
  return {
    ...report,
    ok:
      report.ledgerXp === report.cachedXp &&
      report.expectedLevel === report.cachedLevel &&
      report.expectedRank === report.cachedRank &&
      report.expectedSkillPoints === report.cachedSkillPoints &&
      attributeMismatches.length === 0,
  };
}

/**
 * Rewrites the caches from the ledgers. Never touches the ledgers themselves.
 * Writes an audit event with the before/after values when anything changed.
 */
export async function rebuildProgress(db: AppDb, userId: string, actorUserId: string | null) {
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(playerProgress).where(eq(playerProgress.userId, userId)).for("update");
    const before = await checkProgressConsistency(tx, userId);
    if (before.ok) return before;

    await tx
      .update(playerProgress)
      .set({
        totalXp: Math.max(0, before.ledgerXp),
        level: before.expectedLevel,
        rank: before.expectedRank,
        // Never drop below points already spent (the table's check constraint).
        skillPointsEarned: Math.max(before.expectedSkillPoints, locked?.skillPointsSpent ?? 0),
      })
      .where(eq(playerProgress.userId, userId));
    for (const m of before.attributeMismatches) {
      await tx
        .insert(playerAttribute)
        .values({ userId, attribute: m.attribute, points: m.ledger })
        .onConflictDoUpdate({
          target: [playerAttribute.userId, playerAttribute.attribute],
          set: { points: m.ledger },
        });
    }
    await tx.insert(auditEvent).values({
      actorUserId,
      action: "progress.rebuilt",
      targetType: "player_progress",
      targetId: userId,
      metadata: { before },
    });
    return checkProgressConsistency(tx, userId);
  });
}
