import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  attributeLedger,
  levelEvent,
  playerAttribute,
  playerProfile,
  playerProgress,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { ATTRIBUTE_INFO, LIMITS, RANKS, type Attribute } from "@/lib/progression/config";
import { applyDailyXpCap, applyXp, type ProgressionChange } from "@/lib/progression/rewards";
import { questDay, questDayBounds } from "@/lib/time";
import { notify } from "./notifications";

// The only code that writes XP or attribute points. See docs/ARCHITECTURE.md §7.
//
// Every grant:
//   1. locks the player's progress row (serializes all reward writes for that player),
//   2. inserts an append-only ledger row keyed by a unique idempotency key
//      (a repeat of the same key is reported as a duplicate and changes nothing),
//   3. updates the cached totals derived from the ledger.
// Callers pass a transaction so the reward commits or rolls back with the action
// that earned it (e.g. a quest completion).

export type XpEvent = (typeof xpLedger.$inferInsert)["eventType"];

/** Events that count toward the daily quest-XP cap. */
const CAPPED_EVENTS: XpEvent[] = ["quest_completed", "habit_completed", "focus_completed"];

export type XpGrant = {
  userId: string;
  eventType: Exclude<XpEvent, "adjustment">;
  sourceType: string;
  sourceId?: string | null;
  /** Requested XP, computed by the server from snapshotted rules — never from client input. */
  amount: number;
  reason: string;
  idempotencyKey: string;
  now?: Date;
};

export type XpGrantResult =
  | { status: "duplicate"; idempotencyKey: string }
  | {
      status: "granted";
      ledgerId: string;
      requested: number;
      granted: number;
      /** Explains a reduced grant, e.g. the daily cap. */
      capReason: string | null;
      change: ProgressionChange;
    };

/**
 * Locks the player's progress row for the rest of the transaction. Every reward write
 * takes this lock, so anything counted under it (daily caps, custom limits) is race-free.
 * Lock order: a quest row (if any) first, then this.
 */
export async function lockProgress(tx: AppDb, userId: string) {
  const [row] = await tx
    .select()
    .from(playerProgress)
    .where(eq(playerProgress.userId, userId))
    .for("update");
  if (!row) throw new RewardError("PLAYER_NOT_FOUND", "Player progress not found");
  return row;
}

async function playerDay(tx: AppDb, userId: string, now: Date) {
  const profile = await tx.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { timeZone: true, dayStartHour: true },
  });
  if (!profile) throw new RewardError("PLAYER_NOT_FOUND", "Player profile not found");
  const day = questDay(now, profile.timeZone, profile.dayStartHour);
  return { day, ...questDayBounds(day, profile.timeZone, profile.dayStartHour) };
}

export class RewardError extends Error {
  constructor(
    readonly code: "PLAYER_NOT_FOUND" | "INVALID_AMOUNT",
    message: string,
  ) {
    super(message);
  }
}

export async function grantXp(tx: AppDb, grant: XpGrant): Promise<XpGrantResult> {
  if (!Number.isInteger(grant.amount) || grant.amount < 0) {
    throw new RewardError("INVALID_AMOUNT", `XP amount must be a non-negative integer, got ${grant.amount}`);
  }
  const now = grant.now ?? new Date();
  const progress = await lockProgress(tx, grant.userId);

  // Fast path for retries: the key already exists, nothing else to do.
  const existing = await tx.query.xpLedger.findFirst({
    where: eq(xpLedger.idempotencyKey, grant.idempotencyKey),
    columns: { id: true },
  });
  if (existing) return { status: "duplicate", idempotencyKey: grant.idempotencyKey };

  let granted = grant.amount;
  let capReason: string | null = null;
  if (CAPPED_EVENTS.includes(grant.eventType)) {
    const { start, end } = await playerDay(tx, grant.userId, now);
    const [{ earned }] = await tx
      .select({ earned: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
      .from(xpLedger)
      .where(
        and(
          eq(xpLedger.userId, grant.userId),
          inArray(xpLedger.eventType, CAPPED_EVENTS),
          gte(xpLedger.createdAt, start),
          lt(xpLedger.createdAt, end),
        ),
      );
    const capped = applyDailyXpCap(grant.amount, earned);
    granted = capped.granted;
    capReason = capped.reason;
  }

  // The row lock makes a conflict here impossible in practice; the unique key is the backstop.
  const [ledger] = await tx
    .insert(xpLedger)
    .values({
      userId: grant.userId,
      eventType: grant.eventType,
      sourceType: grant.sourceType,
      sourceId: grant.sourceId ?? null,
      amount: granted,
      reason: capReason ? `${grant.reason} (${capReason})` : grant.reason,
      idempotencyKey: grant.idempotencyKey,
      createdAt: now,
    })
    .onConflictDoNothing({ target: xpLedger.idempotencyKey })
    .returning({ id: xpLedger.id });
  if (!ledger) return { status: "duplicate", idempotencyKey: grant.idempotencyKey };

  const change = applyXp(progress.totalXp, granted);
  await tx
    .update(playerProgress)
    .set({
      totalXp: change.toXp,
      level: change.toLevel,
      rank: change.toRank,
      skillPointsEarned: progress.skillPointsEarned + change.skillPointsGained,
    })
    .where(eq(playerProgress.userId, grant.userId));

  if (change.levelsGained > 0) {
    await tx.insert(levelEvent).values({
      userId: grant.userId,
      fromLevel: change.fromLevel,
      toLevel: change.toLevel,
      fromRank: change.fromRank,
      toRank: change.toRank,
      ledgerId: ledger.id,
      createdAt: now,
    });
    await notify(tx, {
      userId: grant.userId,
      type: "level_up",
      title: "Level up",
      body: `Level ${change.fromLevel} → ${change.toLevel}. +${change.skillPointsGained} skill point${change.skillPointsGained === 1 ? "" : "s"}.`,
      href: "/system",
      // Levels only increase, so each level can be announced once.
      dedupeKey: `level:${grant.userId}:${change.toLevel}`,
      createdAt: now,
    });
  }
  if (change.rankChanged) {
    const label = RANKS.find((r) => r.id === change.toRank)!.label;
    await notify(tx, {
      userId: grant.userId,
      type: "rank_up",
      title: "Rank up",
      body: `You have reached ${label}.`,
      href: "/system",
      dedupeKey: `rank:${grant.userId}:${change.toRank}`,
      createdAt: now,
    });
  }

  return { status: "granted", ledgerId: ledger.id, requested: grant.amount, granted, capReason, change };
}

export type AttributeGrant = {
  userId: string;
  attribute: Attribute;
  amount: number;
  sourceType: string;
  sourceId?: string | null;
  idempotencyKey: string;
  now?: Date;
};

export type AttributeGrantResult =
  | { status: "duplicate" }
  | { status: "granted"; attribute: Attribute; requested: number; granted: number; capReason: string | null };

/** Adds attribute points, capped per attribute per player day. */
export async function grantAttribute(tx: AppDb, grant: AttributeGrant): Promise<AttributeGrantResult> {
  if (!Number.isInteger(grant.amount) || grant.amount < 0) {
    throw new RewardError("INVALID_AMOUNT", `Attribute amount must be a non-negative integer, got ${grant.amount}`);
  }
  const now = grant.now ?? new Date();
  await lockProgress(tx, grant.userId);

  const existing = await tx.query.attributeLedger.findFirst({
    where: eq(attributeLedger.idempotencyKey, grant.idempotencyKey),
    columns: { id: true },
  });
  if (existing) return { status: "duplicate" };

  const { start, end } = await playerDay(tx, grant.userId, now);
  const [{ earned }] = await tx
    .select({ earned: sql<number>`coalesce(sum(${attributeLedger.amount}), 0)::int` })
    .from(attributeLedger)
    .where(
      and(
        eq(attributeLedger.userId, grant.userId),
        eq(attributeLedger.attribute, grant.attribute),
        gte(attributeLedger.createdAt, start),
        lt(attributeLedger.createdAt, end),
      ),
    );
  const granted = Math.min(grant.amount, Math.max(0, LIMITS.dailyAttributeCap - earned));
  const capReason =
    granted < grant.amount
      ? `Daily ${ATTRIBUTE_INFO[grant.attribute].label} limit of ${LIMITS.dailyAttributeCap} reached.`
      : null;

  const [row] = await tx
    .insert(attributeLedger)
    .values({
      userId: grant.userId,
      attribute: grant.attribute,
      amount: granted,
      sourceType: grant.sourceType,
      sourceId: grant.sourceId ?? null,
      idempotencyKey: grant.idempotencyKey,
      createdAt: now,
    })
    .onConflictDoNothing({ target: attributeLedger.idempotencyKey })
    .returning({ id: attributeLedger.id });
  if (!row) return { status: "duplicate" };

  if (granted > 0) {
    await tx
      .insert(playerAttribute)
      .values({ userId: grant.userId, attribute: grant.attribute, points: granted })
      .onConflictDoUpdate({
        target: [playerAttribute.userId, playerAttribute.attribute],
        set: { points: sql`${playerAttribute.points} + ${granted}` },
      });
  }
  return { status: "granted", attribute: grant.attribute, requested: grant.amount, granted, capReason };
}
