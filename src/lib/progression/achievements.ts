import type { Category } from "./config";

// Achievement criteria and skill effects — docs/ARCHITECTURE.md §6d. Pure: metrics in, verdicts out.

export type AchievementCriteria =
  | { type: "quests_completed"; threshold: number }
  | { type: "level"; threshold: number }
  | { type: "category_quests"; threshold: number; category: Category }
  | { type: "weekly_completed"; threshold: number }
  | { type: "habit_streak"; threshold: number }
  | { type: "habit_checkins"; threshold: number }
  | { type: "skills_unlocked"; threshold: number }
  | { type: "goals_completed"; threshold: number }
  | { type: "focus_sessions"; threshold: number }
  | { type: "perfect_days"; threshold: number }
  | { type: "bosses_defeated"; threshold: number }
  | { type: "event_quests"; threshold: number }
  | { type: "early_quests"; threshold: number }
  | { type: "late_quests"; threshold: number }
  | { type: "day_streak"; threshold: number }
  | { type: "friends"; threshold: number }
  | { type: "cheers_given"; threshold: number }
  | { type: "verified_quests"; threshold: number };

/** Everything criteria can look at, computed from persisted records. */
export type PlayerMetrics = {
  questsCompleted: number;
  level: number;
  categoryQuests: Partial<Record<Category, number>>;
  weeklyCompleted: number;
  /** Best current streak (in scheduled days) across active day-scheduled habits. */
  bestHabitStreak: number;
  habitCheckIns: number;
  skillsUnlocked: number;
  goalsCompleted: number;
  /** Completed (full-length) focus sessions. */
  focusSessions: number;
  /** Days on which every daily quest was completed (daily combos earned). */
  perfectDays: number;
  bossesDefeated: number;
  eventQuests: number;
  /** Quests completed between 4 and 6 AM, player's local time. */
  earlyQuests: number;
  /** Quests completed between 11 PM and 4 AM, player's local time. */
  lateQuests: number;
  /** Current day streak, freezes included. */
  dayStreak: number;
  friends: number;
  cheersGiven: number;
  /** The player's quests that a friend confirmed. */
  verifiedQuests: number;
};

export function metricFor(c: AchievementCriteria, m: PlayerMetrics): number {
  switch (c.type) {
    case "quests_completed":
      return m.questsCompleted;
    case "level":
      return m.level;
    case "category_quests":
      return m.categoryQuests[c.category] ?? 0;
    case "weekly_completed":
      return m.weeklyCompleted;
    case "habit_streak":
      return m.bestHabitStreak;
    case "habit_checkins":
      return m.habitCheckIns;
    case "skills_unlocked":
      return m.skillsUnlocked;
    case "goals_completed":
      return m.goalsCompleted;
    case "focus_sessions":
      return m.focusSessions;
    case "perfect_days":
      return m.perfectDays;
    case "bosses_defeated":
      return m.bossesDefeated;
    case "event_quests":
      return m.eventQuests;
    case "early_quests":
      return m.earlyQuests;
    case "late_quests":
      return m.lateQuests;
    case "day_streak":
      return m.dayStreak;
    case "friends":
      return m.friends;
    case "cheers_given":
      return m.cheersGiven;
    case "verified_quests":
      return m.verifiedQuests;
  }
}

export function meetsCriteria(c: AchievementCriteria, m: PlayerMetrics): boolean {
  return metricFor(c, m) >= c.threshold;
}

/** 0–1 progress plus the raw numbers, for locked achievement cards. */
export function criteriaProgress(c: AchievementCriteria, m: PlayerMetrics) {
  const current = Math.min(metricFor(c, m), c.threshold);
  return { current, target: c.threshold, ratio: current / c.threshold };
}

/**
 * What unlocking a skill does. Effects add content (quests, challenges, insights); none
 * change XP amounts, so skills can't be used to farm rewards.
 */
export type SkillEffect =
  | { type: "daily_template"; templateKey: string }
  | { type: "weekly_template"; templateKey: string }
  | { type: "habit_insights" }
  | { type: "focus_lengths"; minutes: number[] };

export type SkillDef = {
  code: string;
  requiredLevel: number;
  prerequisiteCode: string | null;
  cost: number;
  /** False while the feature the effect needs doesn't exist yet. */
  available: boolean;
};

export type SkillBlocker =
  | { reason: "unlocked" }
  | { reason: "unavailable" }
  | { reason: "level"; requiredLevel: number }
  | { reason: "prerequisite"; prerequisiteCode: string }
  | { reason: "points"; cost: number; available: number };

/** Why a skill can't be unlocked right now, or null if it can. Server and UI share this. */
export function skillBlocker(
  s: SkillDef,
  player: { level: number; pointsAvailable: number; unlocked: ReadonlySet<string> },
): SkillBlocker | null {
  if (player.unlocked.has(s.code)) return { reason: "unlocked" };
  if (!s.available) return { reason: "unavailable" };
  if (player.level < s.requiredLevel) return { reason: "level", requiredLevel: s.requiredLevel };
  if (s.prerequisiteCode && !player.unlocked.has(s.prerequisiteCode)) {
    return { reason: "prerequisite", prerequisiteCode: s.prerequisiteCode };
  }
  if (player.pointsAvailable < s.cost) return { reason: "points", cost: s.cost, available: player.pointsAvailable };
  return null;
}
