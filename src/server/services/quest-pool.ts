import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { auditEvent, playerQuest, questTemplate } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { CATEGORY_INFO } from "@/lib/progression/config";
import { DEFAULT_DAILY_QUESTS } from "@/lib/progression/daily-rotation";
import type { PoolQuestInput } from "@/lib/validation/quest";

// The shared pool of daily quests that rotate through every player's day (admin only).
// Seeded quests are rewritten by `pnpm db:deploy`, so only quests added here can be edited; any quest
// can be retired or brought back (the seed never touches `is_active`).

export const ADMIN_KEY_PREFIX = "admin.";
export const POOL_STATS_DAYS = 30;
/** Retiring stops at this many active quests, so every player can still get a full, varied day. */
export const MIN_ACTIVE_POOL = DEFAULT_DAILY_QUESTS * 3;

export class PoolError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "SEEDED" | "TOO_FEW",
    message: string,
  ) {
    super(message);
  }
}

const poolWhere = and(isNull(questTemplate.ownerUserId), isNull(questTemplate.requiredSkill), eq(questTemplate.cadence, "daily"));

/** The pool with how players received each quest over the last 30 days, most-skipped first. */
export async function listQuestPool(db: AppDb, now = new Date()) {
  const since = new Date(now.getTime() - POOL_STATS_DAYS * 86_400_000);
  const stats = db
    .select({
      templateId: playerQuest.templateId,
      offered: sql<number>`count(*)::int`.as("offered"),
      completed: sql<number>`count(*) filter (where ${playerQuest.status} = 'completed')::int`.as("completed"),
      skipped: sql<number>`count(*) filter (where ${playerQuest.status} = 'cancelled')::int`.as("skipped"),
      expired: sql<number>`count(*) filter (where ${playerQuest.status} = 'expired')::int`.as("expired"),
    })
    .from(playerQuest)
    .where(gte(playerQuest.createdAt, since))
    .groupBy(playerQuest.templateId)
    .as("stats");
  const rows = await db
    .select({
      id: questTemplate.id,
      key: questTemplate.key,
      title: questTemplate.title,
      description: questTemplate.description,
      category: questTemplate.category,
      difficulty: questTemplate.difficulty,
      estimatedMinutes: questTemplate.estimatedMinutes,
      isActive: questTemplate.isActive,
      offered: sql<number>`coalesce(${stats.offered}, 0)`,
      completed: sql<number>`coalesce(${stats.completed}, 0)`,
      skipped: sql<number>`coalesce(${stats.skipped}, 0)`,
      expired: sql<number>`coalesce(${stats.expired}, 0)`,
    })
    .from(questTemplate)
    .leftJoin(stats, eq(stats.templateId, questTemplate.id))
    .where(poolWhere);
  const skipRate = (r: (typeof rows)[number]) => (r.offered ? (r.skipped + r.expired) / r.offered : 0);
  return rows
    .map((r) => ({ ...r, editable: !!r.key?.startsWith(ADMIN_KEY_PREFIX), skipRate: skipRate(r) }))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.skipRate - a.skipRate || a.title.localeCompare(b.title));
}

async function audit(tx: AppDb, adminId: string, action: string, templateId: string, metadata: Record<string, unknown>) {
  await tx.insert(auditEvent).values({ actorUserId: adminId, action, targetType: "quest_template", targetId: templateId, metadata });
}

export async function createPoolQuest(db: AppDb, adminId: string, input: PoolQuestInput) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(questTemplate)
      .values({
        key: `${ADMIN_KEY_PREFIX}${crypto.randomUUID().slice(0, 8)}`,
        title: input.title,
        description: input.description,
        category: input.category,
        difficulty: input.difficulty,
        attribute: CATEGORY_INFO[input.category].attribute,
        estimatedMinutes: input.estimatedMinutes,
        cadence: "daily",
      })
      .returning({ id: questTemplate.id });
    await audit(tx, adminId, "quest_pool.create", row.id, { title: input.title });
    return row.id;
  });
}

export async function updatePoolQuest(db: AppDb, adminId: string, id: string, input: PoolQuestInput) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.questTemplate.findFirst({ where: and(eq(questTemplate.id, id), poolWhere) });
    if (!existing) throw new PoolError("NOT_FOUND", "That quest isn't in the pool.");
    if (!existing.key?.startsWith(ADMIN_KEY_PREFIX)) {
      throw new PoolError("SEEDED", "Built-in quests are reset on every deploy. Retire it and add your own version instead.");
    }
    // Quests already handed out keep their snapshot; this changes future days only.
    await tx
      .update(questTemplate)
      .set({
        title: input.title,
        description: input.description,
        category: input.category,
        difficulty: input.difficulty,
        attribute: CATEGORY_INFO[input.category].attribute,
        estimatedMinutes: input.estimatedMinutes,
      })
      .where(eq(questTemplate.id, id));
    await audit(tx, adminId, "quest_pool.update", id, { title: input.title });
  });
}

/** Retires a quest from rotation or brings it back. Players keep any copy they already have. */
export async function setPoolQuestActive(db: AppDb, adminId: string, id: string, active: boolean) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.questTemplate.findFirst({ where: and(eq(questTemplate.id, id), poolWhere) });
    if (!existing) throw new PoolError("NOT_FOUND", "That quest isn't in the pool.");
    if (!active && existing.isActive) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(questTemplate)
        .where(and(poolWhere, eq(questTemplate.isActive, true)));
      if (n <= MIN_ACTIVE_POOL) {
        throw new PoolError("TOO_FEW", `Keep at least ${MIN_ACTIVE_POOL} quests active so players still get a varied day.`);
      }
    }
    await tx.update(questTemplate).set({ isActive: active }).where(eq(questTemplate.id, id));
    await audit(tx, adminId, active ? "quest_pool.activate" : "quest_pool.retire", id, { title: existing.title });
  });
}
