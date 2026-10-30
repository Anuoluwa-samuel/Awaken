import { and, count, eq, gte, isNull, lt } from "drizzle-orm";
import { goal, goalMilestone, playerProfile, playerProgress, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { goalProgress, goalRewardCheck } from "@/lib/progression/goals";
import { applyXp, type ProgressionChange } from "@/lib/progression/rewards";
import { questDay, questDayBounds } from "@/lib/time";
import { evaluateAchievements, type UnlockedAchievement } from "./achievements";
import { notify } from "./notifications";
import { grantXp, lockProgress } from "./rewards";

// Goal completion shared by milestone and quest flows (no dependency on the quest service,
// which calls into here). Lock order everywhere: quest → player → goal.

/**
 * Called inside quest completion: marks milestones linked to the quest done and completes
 * their goals when finished. Returns the goal completion (if any) for the result.
 */
export async function recordMilestonesForQuest(tx: AppDb, userId: string, questId: string, now: Date) {
  const linked = await tx
    .update(goalMilestone)
    .set({ completedAt: now })
    .where(and(eq(goalMilestone.userId, userId), eq(goalMilestone.playerQuestId, questId), isNull(goalMilestone.completedAt)))
    .returning({ goalId: goalMilestone.goalId });
  let result: GoalCompletion | null = null;
  for (const { goalId } of linked) result = (await completeGoalIfDone(tx, userId, goalId, now)) ?? result;
  return result;
}

export type GoalCompletion = {
  title: string;
  xp: { granted: number; note: string | null };
  achievements: UnlockedAchievement[];
  levelChange: ProgressionChange | null;
};

export async function completeGoalIfDone(tx: AppDb, userId: string, goalId: string, now: Date): Promise<GoalCompletion | null> {
  // Lock the goal before reading milestones: when the last two milestones finish in parallel,
  // the second transaction waits here and then sees both as done.
  const [g] = await tx
    .select()
    .from(goal)
    .where(and(eq(goal.id, goalId), eq(goal.userId, userId)))
    .for("no key update");
  if (!g || g.status !== "active") return null;
  const milestones = await tx.query.goalMilestone.findMany({ where: eq(goalMilestone.goalId, g.id) });
  if (!goalProgress(milestones).complete) return null;

  const [done] = await tx
    .update(goal)
    .set({ status: "completed", completedAt: now })
    .where(and(eq(goal.id, g.id), eq(goal.status, "active")))
    .returning();
  if (!done) return null;

  const before = await lockProgress(tx, userId);
  const profile = await tx.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { timeZone: true, dayStartHour: true },
  });
  const today = questDay(now, profile!.timeZone, profile!.dayStartHour);
  const clock = { today, ...questDayBounds(today, profile!.timeZone, profile!.dayStartHour) };
  const [{ rewardedToday }] = await tx
    .select({ rewardedToday: count() })
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.userId, userId),
        eq(xpLedger.eventType, "goal_completed"),
        eq(xpLedger.sourceType, "goal"),
        gte(xpLedger.createdAt, clock.start),
        lt(xpLedger.createdAt, clock.end),
      ),
    );
  const check = goalRewardCheck({ milestoneCount: milestones.length, startDate: g.startDate, today: clock.today, rewardedToday });
  let xp = { granted: 0, note: check.eligible ? null : check.reason };
  if (check.eligible) {
    const grant = await grantXp(tx, {
      userId,
      eventType: "goal_completed",
      sourceType: "goal",
      sourceId: g.id,
      amount: check.xp,
      reason: `Goal: ${g.title}`,
      idempotencyKey: `goal:${g.id}`,
      now,
    });
    xp = grant.status === "granted" ? { granted: grant.granted, note: grant.capReason } : { granted: 0, note: "Already rewarded." };
  }
  await notify(tx, {
    userId,
    type: "system",
    title: "Goal completed",
    body: `${g.title}${xp.granted ? ` · +${xp.granted} XP` : ""}`,
    href: "/system/goals",
    dedupeKey: `goal:${g.id}`,
    createdAt: now,
  });
  const achievements = await evaluateAchievements(tx, userId, now);
  const after = await tx.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
  const change = applyXp(before.totalXp, (after?.totalXp ?? before.totalXp) - before.totalXp);
  return { title: g.title, xp, achievements, levelChange: change.levelsGained > 0 ? change : null };
}

