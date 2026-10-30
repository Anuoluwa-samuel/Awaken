import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { playerProfile, playerSkill, questTemplate, weeklyChallenge } from "@/db/schema";
import { SYSTEM_QUEST_TEMPLATES } from "@/db/seed-data";
import type { AppDb } from "@/db/types";
import { DIFFICULTY_XP, WEEKLY_XP_MULTIPLIER, type Category } from "@/lib/progression/config";
import { addDays, questDay, questDayBounds, weekStart, type QuestDate } from "@/lib/time";
import { notify } from "./notifications";
import { grantXp } from "./rewards";

// Weekly challenges: "complete N quests of a category this week".
// Weeks run Monday–Sunday in the player's quest days. Progress only moves when a
// quest is completed (see completeQuest), and the reward is granted the first time
// the target is reached — keyed `weekly:{challengeId}`, so it can never repeat.

/** Which system weekly templates a player gets, from their focus areas. */
export function weeklyTemplateKeysFor(
  focusAreas: readonly Category[],
  unlockedSkills: ReadonlySet<string> = new Set(),
): string[] {
  return SYSTEM_QUEST_TEMPLATES.filter(
    (t) =>
      t.cadence === "weekly" &&
      (t.requiredSkill
        ? unlockedSkills.has(t.requiredSkill)
        : t.weeklyDefault || focusAreas.includes(t.category)),
  ).map((t) => t.key);
}

/** Idempotently creates this week's challenges and expires last week's unfinished ones. */
export async function ensureWeeklyChallenges(db: AppDb, userId: string, now = new Date()): Promise<QuestDate> {
  return db.transaction(async (tx) => {
    const profile = await tx.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId) });
    if (!profile) throw new Error("Player profile not found");
    const today = questDay(now, profile.timeZone, profile.dayStartHour);
    const week = weekStart(today);
    const deadline = questDayBounds(addDays(week, 7), profile.timeZone, profile.dayStartHour).start;

    await tx
      .update(weeklyChallenge)
      .set({ status: "expired" })
      .where(
        and(
          eq(weeklyChallenge.userId, userId),
          eq(weeklyChallenge.status, "active"),
          lte(weeklyChallenge.deadlineAt, now),
        ),
      );

    const skills = await tx
      .select({ code: playerSkill.skillCode })
      .from(playerSkill)
      .where(eq(playerSkill.userId, userId));
    const keys = weeklyTemplateKeysFor(profile.focusAreas, new Set(skills.map((s) => s.code)));
    if (keys.length === 0) return week;
    const templates = await tx
      .select()
      .from(questTemplate)
      .where(
        and(
          inArray(questTemplate.key, keys),
          isNull(questTemplate.ownerUserId),
          eq(questTemplate.isActive, true),
        ),
      );
    const anyCategory = new Set(SYSTEM_QUEST_TEMPLATES.filter((t) => t.weeklyAnyCategory).map((t) => t.key));
    if (templates.length > 0) {
      await tx
        .insert(weeklyChallenge)
        .values(
          templates.map((t) => ({
            userId,
            templateId: t.id,
            title: t.title,
            category: t.category,
            countsAnyCategory: anyCategory.has(t.key!),
            target: t.weeklyTarget ?? 1,
            weekStart: week,
            deadlineAt: deadline,
            xpReward: t.xpReward ?? DIFFICULTY_XP[t.difficulty] * WEEKLY_XP_MULTIPLIER,
          })),
        )
        .onConflictDoNothing({
          target: [weeklyChallenge.userId, weeklyChallenge.templateId, weeklyChallenge.weekStart],
        });
    }
    return week;
  });
}

export type WeeklyAdvance = { challengeId: string; title: string; progress: number; target: number; completed: boolean; xpGranted: number };

/**
 * Advances active challenges matching a completed quest. Must run inside the quest
 * completion transaction (the quest row lock guarantees this runs once per quest).
 */
export async function advanceWeeklyChallenges(
  tx: AppDb,
  userId: string,
  category: Category,
  now: Date,
): Promise<WeeklyAdvance[]> {
  const rows = await tx
    .select()
    .from(weeklyChallenge)
    .where(
      and(
        eq(weeklyChallenge.userId, userId),
        eq(weeklyChallenge.status, "active"),
        gt(weeklyChallenge.deadlineAt, now),
        or(eq(weeklyChallenge.category, category), eq(weeklyChallenge.countsAnyCategory, true)),
      ),
    )
    .orderBy(asc(weeklyChallenge.createdAt))
    .for("update");

  const results: WeeklyAdvance[] = [];
  for (const c of rows) {
    const progress = Math.min(c.target, c.progress + 1);
    const reached = progress >= c.target;
    await tx
      .update(weeklyChallenge)
      .set({
        progress,
        ...(reached ? { status: "completed" as const, completedAt: now } : {}),
      })
      .where(eq(weeklyChallenge.id, c.id));

    let xpGranted = 0;
    if (reached) {
      const grant = await grantXp(tx, {
        userId,
        eventType: "weekly_completed",
        sourceType: "weekly_challenge",
        sourceId: c.id,
        amount: c.xpReward,
        reason: `Weekly challenge: ${c.title}`,
        idempotencyKey: `weekly:${c.id}`,
        now,
      });
      if (grant.status === "granted") {
        xpGranted = grant.granted;
        await tx.update(weeklyChallenge).set({ rewardClaimedAt: now }).where(eq(weeklyChallenge.id, c.id));
        await notify(tx, {
          userId,
          type: "weekly",
          title: "Weekly challenge completed",
          body: `${c.title} · +${grant.granted} XP`,
          href: "/system/quests",
          dedupeKey: `weekly:${c.id}`,
          createdAt: now,
        });
      }
    }
    results.push({ challengeId: c.id, title: c.title, progress, target: c.target, completed: reached, xpGranted });
  }
  return results;
}

export async function listWeeklyChallenges(db: AppDb, userId: string, week: QuestDate) {
  return db.query.weeklyChallenge.findMany({
    where: and(eq(weeklyChallenge.userId, userId), eq(weeklyChallenge.weekStart, week)),
    orderBy: [asc(weeklyChallenge.createdAt)],
  });
}
