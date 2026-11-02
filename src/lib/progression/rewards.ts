import {
  CUSTOM_XP_MAX_MULTIPLIER,
  CUSTOM_XP_MIN,
  DIFFICULTY_ATTRIBUTE_POINTS,
  DIFFICULTY_XP,
  LIMITS,
  type Difficulty,
  type RankId,
} from "./config";
import { levelFromXp, rankForLevel } from "./levels";

/** Bounds a player may choose for a custom quest's XP at a given difficulty. */
export function customXpBounds(difficulty: Difficulty) {
  return { min: CUSTOM_XP_MIN, max: DIFFICULTY_XP[difficulty] * CUSTOM_XP_MAX_MULTIPLIER };
}

/**
 * The XP a quest will award, snapshotted when the quest is created.
 * A requested custom value is clamped into the allowed range, never trusted.
 */
export function resolveQuestXp(difficulty: Difficulty, requested?: number | null): number {
  if (requested == null) return DIFFICULTY_XP[difficulty];
  if (!Number.isFinite(requested)) return DIFFICULTY_XP[difficulty];
  const { min, max } = customXpBounds(difficulty);
  return Math.min(max, Math.max(min, Math.round(requested)));
}

export function attributePointsFor(difficulty: Difficulty, earnedTodayForAttribute: number): number {
  const room = Math.max(0, LIMITS.dailyAttributeCap - earnedTodayForAttribute);
  return Math.min(DIFFICULTY_ATTRIBUTE_POINTS[difficulty], room);
}

export type ProgressionChange = {
  fromXp: number;
  toXp: number;
  fromLevel: number;
  toLevel: number;
  levelsGained: number;
  fromRank: RankId;
  toRank: RankId;
  rankChanged: boolean;
  skillPointsGained: number;
};

/** What happens to a player's level and rank when `amount` XP is added. */
export function applyXp(currentXp: number, amount: number): ProgressionChange {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`amount must be a non-negative integer, got ${amount}`);
  }
  const toXp = currentXp + amount;
  const fromLevel = levelFromXp(currentXp);
  const toLevel = levelFromXp(toXp);
  const fromRank = rankForLevel(fromLevel).id;
  const toRank = rankForLevel(toLevel).id;
  return {
    fromXp: currentXp,
    toXp,
    fromLevel,
    toLevel,
    levelsGained: toLevel - fromLevel,
    fromRank,
    toRank,
    rankChanged: fromRank !== toRank,
    skillPointsGained: (toLevel - fromLevel) * LIMITS.skillPointsPerLevel,
  };
}
