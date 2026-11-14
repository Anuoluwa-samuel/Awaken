import { addDays, weekStart, type QuestDate } from "@/lib/time";
import type { Category } from "./config";
import { hash } from "./daily-rotation";

// Extra rewards on top of quest XP. Pure: dates and numbers in, decisions out.

export const BONUS_RULES = {
  /** Daily combo: a share of the day's quest XP for finishing every daily quest. */
  comboShare: 0.2,
  comboMinimum: 10,
  /** At least this many quests in the day for it to count as a combo. */
  comboMinQuests: 2,
  /** Roughly one day in this many has a System event. */
  eventOneIn: 6,
  eventXpMultiplier: 2,
  /** Boss quests are worth this many times a normal weekly challenge. */
  bossXpMultiplier: 2,
  /** Missed days per Monday–Sunday week that don't break a streak. */
  streakFreezesPerWeek: 1,
  /** Bonus for a quest a friend confirms: a share of its XP. */
  verifiedShare: 0.2,
  verifiedMinimum: 5,
} as const;

export function comboBonus(questXp: number) {
  return Math.max(BONUS_RULES.comboMinimum, Math.round(questXp * BONUS_RULES.comboShare));
}

export function verifiedBonus(questXp: number) {
  return Math.max(BONUS_RULES.verifiedMinimum, Math.round(questXp * BONUS_RULES.verifiedShare));
}

/** Whether a player gets a System event on this day. Deterministic, so every request agrees. */
export function isEventDay(userId: string, day: QuestDate) {
  return hash(`event:${userId}:${day}`) % BONUS_RULES.eventOneIn === 0;
}

/** Picks the event quest: one the player isn't already doing today, preferring their focus areas. */
export function pickEventTemplate<T extends { id: string; category: Category }>(
  pool: readonly T[],
  exclude: ReadonlySet<string>,
  focusAreas: readonly Category[],
  seed: string,
): T | null {
  const candidates = pool.filter((t) => !exclude.has(t.id));
  if (candidates.length === 0) return null;
  const focused = candidates.filter((t) => focusAreas.includes(t.category));
  const from = focused.length > 0 ? focused : candidates;
  return [...from].sort((a, b) => hash(seed + a.id) - hash(seed + b.id))[0];
}

/** This week's boss: the same all week for a player, different between players and weeks. */
export function pickBossKey(keys: readonly string[], userId: string, week: QuestDate): string | null {
  if (keys.length === 0) return null;
  return keys[hash(`boss:${userId}:${week}`) % keys.length];
}

export type StreakState = {
  /** Consecutive active days, ending today or yesterday. Frozen days don't add to it. */
  current: number;
  /** Missed days that a freeze bridged, newest first. */
  frozen: QuestDate[];
  /** Whether this week's freeze is still unused. */
  freezeAvailable: boolean;
};

/**
 * Day streak with freezes: in each Monday–Sunday week, one missed day between active days is forgiven.
 * Today not being finished yet never breaks the streak — the day isn't over.
 */
export function dayStreak(activeDates: Iterable<QuestDate>, today: QuestDate): StreakState {
  const days = new Set(activeDates);
  const usedByWeek = new Map<QuestDate, number>();
  const frozen: QuestDate[] = [];
  let cursor = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  for (;;) {
    if (days.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
      continue;
    }
    const week = weekStart(cursor);
    const used = usedByWeek.get(week) ?? 0;
    // Only bridge a single missed day that has an active day before it, inside an existing streak.
    if (current > 0 || cursor === addDays(today, -1)) {
      if (used < BONUS_RULES.streakFreezesPerWeek && days.has(addDays(cursor, -1))) {
        usedByWeek.set(week, used + 1);
        frozen.push(cursor);
        cursor = addDays(cursor, -1);
        continue;
      }
    }
    break;
  }
  const thisWeek = usedByWeek.get(weekStart(today)) ?? 0;
  return { current, frozen, freezeAvailable: thisWeek < BONUS_RULES.streakFreezesPerWeek };
}

/** Streak flame tiers: each looks stronger than the last. */
export const FLAME_TIERS = [
  { min: 100, tier: 4, label: "Legendary flame" },
  { min: 30, tier: 3, label: "Blazing flame" },
  { min: 7, tier: 2, label: "Steady flame" },
  { min: 1, tier: 1, label: "Spark" },
] as const;

export function flameTier(streak: number) {
  return FLAME_TIERS.find((t) => streak >= t.min) ?? { min: 0, tier: 0, label: "No flame yet" };
}
