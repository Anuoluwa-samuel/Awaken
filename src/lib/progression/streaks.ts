import { addDays, type QuestDate } from "@/lib/time";

/**
 * Consecutive quest days with at least one completion, ending today or yesterday.
 * Today not being finished yet never breaks the streak — the day isn't over.
 */
export function activeDayStreak(activeDates: Iterable<QuestDate>, today: QuestDate): number {
  const days = new Set(activeDates);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
