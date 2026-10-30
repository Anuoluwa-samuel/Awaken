import { GOAL_RULES } from "./config";
import type { QuestDate } from "@/lib/time";

// Goals — docs/ARCHITECTURE.md §6e. Progress comes only from completed milestones.

export function goalProgress(milestones: { completedAt: Date | null }[]) {
  const total = milestones.length;
  const done = milestones.filter((m) => m.completedAt).length;
  return { done, total, ratio: total ? done / total : 0, complete: total > 0 && done === total };
}

export function goalRewardXp(milestoneCount: number): number {
  return Math.min(GOAL_RULES.maxXp, GOAL_RULES.xpPerMilestone * milestoneCount);
}

export type GoalRewardCheck = { eligible: true; xp: number } | { eligible: false; reason: string };

/** Whether completing a goal earns XP, and why not — shown to the player. */
export function goalRewardCheck(input: {
  milestoneCount: number;
  startDate: QuestDate;
  today: QuestDate;
  rewardedToday: number;
}): GoalRewardCheck {
  if (input.milestoneCount < GOAL_RULES.minMilestones) {
    return { eligible: false, reason: `Goals need at least ${GOAL_RULES.minMilestones} milestones to earn XP.` };
  }
  if (input.startDate >= input.today) {
    return { eligible: false, reason: "Goals finished on the day they're created don't earn XP." };
  }
  if (input.rewardedToday >= GOAL_RULES.maxRewardedPerDay) {
    return { eligible: false, reason: `Up to ${GOAL_RULES.maxRewardedPerDay} goal rewards per day — recorded without XP.` };
  }
  return { eligible: true, xp: goalRewardXp(input.milestoneCount) };
}
