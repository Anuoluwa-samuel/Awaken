import { addDays, type QuestDate } from "@/lib/time";

// Pure helpers for the progress page. All series are keyed by the player's quest day.

export const RANGES = {
  "7d": { days: 7, label: "7 days" },
  "30d": { days: 30, label: "30 days" },
  "90d": { days: 90, label: "90 days" },
  "1y": { days: 365, label: "1 year" },
} as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(value: unknown): RangeKey {
  return typeof value === "string" && value in RANGES ? (value as RangeKey) : "30d";
}

/** Inclusive [from, to] ending today. */
export function rangeBounds(today: QuestDate, key: RangeKey): { from: QuestDate; to: QuestDate } {
  return { from: addDays(today, -(RANGES[key].days - 1)), to: today };
}

export function daysBetween(from: QuestDate, to: QuestDate): QuestDate[] {
  const out: QuestDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** One row per day, zero-filled, so charts never imply missing days were skipped. */
export function fillDaily<K extends string>(
  days: QuestDate[],
  rows: ({ date: QuestDate } & Record<K, number>)[],
  keys: readonly K[],
): ({ date: QuestDate } & Record<K, number>)[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return days.map((date) => {
    const row = byDate.get(date);
    const values = Object.fromEntries(keys.map((k) => [k, row ? Number(row[k]) || 0 : 0])) as Record<K, number>;
    return { date, ...values };
  });
}

/** Running totals from a starting baseline. */
export function cumulative<K extends string>(
  rows: ({ date: QuestDate } & Record<K, number>)[],
  keys: readonly K[],
  baseline: Partial<Record<K, number>> = {},
) {
  const running = Object.fromEntries(keys.map((k) => [k, baseline[k] ?? 0])) as Record<K, number>;
  return rows.map((r) => {
    for (const k of keys) running[k] += r[k];
    return { ...r, ...running };
  });
}

/**
 * For long ranges, sum days into ISO weeks so bars stay readable (≤ ~60 marks).
 * Labelled by the week's first day in range.
 */
export function bucketWeekly<K extends string>(rows: ({ date: QuestDate } & Record<K, number>)[], keys: readonly K[]) {
  const out: ({ date: QuestDate } & Record<K, number>)[] = [];
  for (let i = 0; i < rows.length; i += 7) {
    const chunk = rows.slice(i, i + 7);
    const sums = Object.fromEntries(keys.map((k) => [k, chunk.reduce((s, r) => s + r[k], 0)])) as Record<K, number>;
    out.push({ date: chunk[0].date, ...sums });
  }
  return out;
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function shortDate(date: QuestDate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Longest run of consecutive days present in `dates`. */
export function longestDayRun(dates: Iterable<QuestDate>): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev: QuestDate | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
