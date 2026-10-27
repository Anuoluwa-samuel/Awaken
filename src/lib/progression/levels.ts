import { LEVEL_CURVE, RANKS, type RankId } from "./config";

/** XP needed to advance from `level` to `level + 1`. */
export function xpForLevelUp(level: number): number {
  assertLevel(level);
  return LEVEL_CURVE.base + LEVEL_CURVE.increment * (level - 1);
}

/** Lifetime XP at which a player first reaches `level`. */
export function xpToReach(level: number): number {
  assertLevel(level);
  const n = level - 1;
  return LEVEL_CURVE.base * n + (LEVEL_CURVE.increment / 2) * n * (n - 1);
}

/** Highest level whose threshold is ≤ lifetime XP. */
export function levelFromXp(totalXp: number): number {
  if (!Number.isInteger(totalXp) || totalXp < 0) {
    throw new RangeError(`totalXp must be a non-negative integer, got ${totalXp}`);
  }
  // Solve the quadratic, then correct for floating-point error at exact boundaries.
  const { base: b, increment: i } = LEVEL_CURVE;
  const a = i / 2;
  const bb = b - a;
  const n = Math.floor((-bb + Math.sqrt(bb * bb + 4 * a * totalXp)) / (2 * a));
  let level = Math.max(1, n + 1);
  while (xpToReach(level + 1) <= totalXp) level++;
  while (level > 1 && xpToReach(level) > totalXp) level--;
  return level;
}

export type LevelProgress = {
  level: number;
  totalXp: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP the current level requires in total. */
  xpForNext: number;
  /** XP still needed to level up. */
  xpRemaining: number;
  /** 0–1 */
  ratio: number;
};

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelFromXp(totalXp);
  const xpIntoLevel = totalXp - xpToReach(level);
  const xpForNext = xpForLevelUp(level);
  return {
    level,
    totalXp,
    xpIntoLevel,
    xpForNext,
    xpRemaining: xpForNext - xpIntoLevel,
    ratio: xpIntoLevel / xpForNext,
  };
}

export type Rank = (typeof RANKS)[number];

export function rankForLevel(level: number): Rank {
  assertLevel(level);
  let current: Rank = RANKS[0];
  for (const rank of RANKS) if (level >= rank.minLevel) current = rank;
  return current;
}

export function nextRank(rankId: RankId): Rank | null {
  const i = RANKS.findIndex((r) => r.id === rankId);
  return RANKS[i + 1] ?? null;
}

export type RankProgress = {
  rank: Rank;
  next: Rank | null;
  /** Lifetime XP needed to reach the next rank's minimum level. */
  xpToNextRank: number | null;
  /** 0–1 progress through the current rank band, measured in XP. */
  ratio: number;
};

export function rankProgress(totalXp: number): RankProgress {
  const rank = rankForLevel(levelFromXp(totalXp));
  const next = nextRank(rank.id);
  if (!next) return { rank, next: null, xpToNextRank: null, ratio: 1 };
  const start = xpToReach(rank.minLevel);
  const end = xpToReach(next.minLevel);
  return { rank, next, xpToNextRank: end - totalXp, ratio: (totalXp - start) / (end - start) };
}

function assertLevel(level: number) {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError(`level must be an integer ≥ 1, got ${level}`);
  }
}
