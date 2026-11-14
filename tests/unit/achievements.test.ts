import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, SKILLS } from "@/db/seed-data";
import {
  criteriaProgress,
  meetsCriteria,
  skillBlocker,
  type PlayerMetrics,
} from "@/lib/progression/achievements";

const zero: PlayerMetrics = {
  questsCompleted: 0,
  level: 1,
  categoryQuests: {},
  weeklyCompleted: 0,
  bestHabitStreak: 0,
  habitCheckIns: 0,
  skillsUnlocked: 0,
  goalsCompleted: 0,
  focusSessions: 0,
  perfectDays: 0,
  bossesDefeated: 0,
  eventQuests: 0,
  earlyQuests: 0,
  lateQuests: 0,
  dayStreak: 0,
  friends: 0,
  cheersGiven: 0,
  verifiedQuests: 0,
};

describe("achievement criteria", () => {
  it("unlocks exactly at the threshold", () => {
    expect(meetsCriteria({ type: "quests_completed", threshold: 1 }, zero)).toBe(false);
    expect(meetsCriteria({ type: "quests_completed", threshold: 1 }, { ...zero, questsCompleted: 1 })).toBe(true);
    expect(meetsCriteria({ type: "level", threshold: 5 }, { ...zero, level: 4 })).toBe(false);
    expect(meetsCriteria({ type: "level", threshold: 5 }, { ...zero, level: 5 })).toBe(true);
  });

  it("counts category quests per category", () => {
    const c = { type: "category_quests", threshold: 25, category: "learning" } as const;
    expect(meetsCriteria(c, { ...zero, categoryQuests: { creativity: 30 } })).toBe(false);
    expect(meetsCriteria(c, { ...zero, categoryQuests: { learning: 25 } })).toBe(true);
  });

  it("reports capped progress for locked cards", () => {
    expect(criteriaProgress({ type: "habit_streak", threshold: 14 }, { ...zero, bestHabitStreak: 7 })).toEqual({
      current: 7,
      target: 14,
      ratio: 0.5,
    });
    expect(criteriaProgress({ type: "habit_checkins", threshold: 10 }, { ...zero, habitCheckIns: 40 }).ratio).toBe(1);
  });

  it("seed data uses unique codes and positive thresholds", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.code)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.every((a) => a.criteria.threshold > 0 && a.xpReward >= 0)).toBe(true);
  });
});

describe("skill prerequisites", () => {
  const bird = SKILLS.find((s) => s.code === "early-bird")!;
  const creator = SKILLS.find((s) => s.code === "creator")!;
  // A skill whose feature hasn't shipped yet.
  const future = { code: "future", requiredLevel: 1, prerequisiteCode: null, cost: 1, available: false };
  const player = (over: Partial<{ level: number; pointsAvailable: number; unlocked: Set<string> }> = {}) => ({
    level: 20,
    pointsAvailable: 10,
    unlocked: new Set<string>(),
    ...over,
  });

  it("allows an eligible unlock", () => {
    expect(skillBlocker(bird, player())).toBeNull();
  });

  it("blocks below the required level, without prerequisites, or without points", () => {
    expect(skillBlocker(bird, player({ level: 2 }))).toEqual({ reason: "level", requiredLevel: 3 });
    expect(skillBlocker(creator, player())).toEqual({ reason: "prerequisite", prerequisiteCode: "consistency" });
    expect(skillBlocker(creator, player({ unlocked: new Set(["early-bird", "consistency"]), pointsAvailable: 1 }))).toEqual({
      reason: "points",
      cost: 2,
      available: 1,
    });
  });

  it("never unlocks twice or unlocks unavailable features", () => {
    expect(skillBlocker(bird, player({ unlocked: new Set(["early-bird"]) }))).toEqual({ reason: "unlocked" });
    expect(skillBlocker(future, player())).toEqual({ reason: "unavailable" });
  });

  it("seed prerequisites reference real skills with lower or equal level requirements", () => {
    for (const s of SKILLS) {
      if (!s.prerequisiteCode) continue;
      const pre = SKILLS.find((p) => p.code === s.prerequisiteCode);
      expect(pre, s.code).toBeDefined();
      expect(pre!.requiredLevel).toBeLessThanOrEqual(s.requiredLevel);
    }
  });
});
