import { addDays, dayOfWeek, weekStart, type QuestDate } from "@/lib/time";

// Habit schedules and streaks — docs/ARCHITECTURE.md §6c. Pure functions over quest days.
//
// Two schedule kinds:
// - "days":  fixed weekdays. Other days are rest days: they never break a streak.
//            The streak counts completed scheduled days in a row.
// - "weekly": N times per week on any days (weeks run Monday–Sunday).
//            The streak counts consecutive weeks that met the target.
// Today (or this week) is never counted as missed — it isn't over yet.
// Nothing before the habit's start date counts against it.

export type HabitSchedule =
  | { kind: "days"; days: readonly number[] }
  | { kind: "weekly"; timesPerWeek: number };

export function scheduleOf(habit: { scheduleDays: readonly number[]; timesPerWeek: number | null }): HabitSchedule {
  return habit.timesPerWeek
    ? { kind: "weekly", timesPerWeek: habit.timesPerWeek }
    : { kind: "days", days: habit.scheduleDays };
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function describeSchedule(s: HabitSchedule): string {
  if (s.kind === "weekly") return `${s.timesPerWeek}× per week`;
  if (s.days.length === 7) return "Every day";
  const sorted = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Monday first
  if (sorted.join() === "1,2,3,4,5") return "Weekdays";
  if (sorted.join() === "6,0") return "Weekends";
  return sorted.map((d) => DAY_SHORT[d]).join(" · ");
}

export function isScheduledDay(s: HabitSchedule, date: QuestDate): boolean {
  return s.kind === "weekly" || s.days.includes(dayOfWeek(date));
}

function countInWeek(done: ReadonlySet<QuestDate>, monday: QuestDate, upTo?: QuestDate): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (upTo && d > upTo) break;
    if (done.has(d)) n++;
  }
  return n;
}

/**
 * Whether a check-in on `date` counts toward the schedule (and so earns the habit reward).
 * `done` must not yet include `date`.
 */
export function checkInCounts(s: HabitSchedule, done: ReadonlySet<QuestDate>, date: QuestDate): boolean {
  if (s.kind === "days") return s.days.includes(dayOfWeek(date));
  return countInWeek(done, weekStart(date)) < s.timesPerWeek;
}

export type HabitStats = {
  unit: "days" | "weeks";
  current: number;
  longest: number;
  /** 0–1 over the last 30 days (days mode) or last 4 complete weeks (weekly); null if nothing was due yet. */
  rate: number | null;
  doneToday: boolean;
  scheduledToday: boolean;
  /** Weekly mode: check-ins so far this week. */
  thisWeek: number;
};

export function habitStats(
  s: HabitSchedule,
  completions: Iterable<QuestDate>,
  startDate: QuestDate,
  today: QuestDate,
): HabitStats {
  const done = new Set([...completions].filter((d) => d >= startDate && d <= today));
  const doneToday = done.has(today);
  return s.kind === "days"
    ? { ...dayStats(s.days, done, startDate, today), doneToday, scheduledToday: s.days.includes(dayOfWeek(today)), thisWeek: countInWeek(done, weekStart(today), today) }
    : { ...weekStats(s.timesPerWeek, done, startDate, today), doneToday, scheduledToday: true, thisWeek: countInWeek(done, weekStart(today), today) };
}

function dayStats(days: readonly number[], done: Set<QuestDate>, start: QuestDate, today: QuestDate) {
  const scheduled = (d: QuestDate) => days.includes(dayOfWeek(d));

  // Current: walk back from today (or yesterday if today isn't done yet), skipping rest days.
  let current = 0;
  for (let d = done.has(today) ? today : addDays(today, -1); d >= start; d = addDays(d, -1)) {
    if (!scheduled(d)) continue;
    if (!done.has(d)) break;
    current++;
  }

  // Longest: forward pass; an unfinished today doesn't end a run.
  let longest = 0;
  let run = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!scheduled(d)) continue;
    if (done.has(d)) longest = Math.max(longest, ++run);
    else if (d !== today) run = 0;
  }

  // Rate over the last 30 days, ignoring an unfinished today and days before the start.
  let due = 0;
  let hit = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (d < start) break;
    if (!scheduled(d) || (d === today && !done.has(d))) continue;
    due++;
    if (done.has(d)) hit++;
  }
  return { unit: "days" as const, current, longest, rate: due ? hit / due : null };
}

function weekStats(target: number, done: Set<QuestDate>, start: QuestDate, today: QuestDate) {
  const firstWeek = weekStart(start);
  const thisWeek = weekStart(today);
  const met = (monday: QuestDate) => countInWeek(done, monday) >= target;

  let current = 0;
  for (let w = met(thisWeek) ? thisWeek : addDays(thisWeek, -7); w >= firstWeek; w = addDays(w, -7)) {
    if (!met(w)) break;
    current++;
  }

  let longest = 0;
  let run = 0;
  for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) {
    if (met(w)) longest = Math.max(longest, ++run);
    else if (w !== thisWeek) run = 0;
  }

  let due = 0;
  let hit = 0;
  for (let i = 1; i <= 4; i++) {
    const w = addDays(thisWeek, -7 * i);
    if (w < firstWeek) break;
    due++;
    if (met(w)) hit++;
  }
  return { unit: "weeks" as const, current, longest, rate: due ? hit / due : null };
}

export type HeatCell = { date: QuestDate; state: "done" | "missed" | "rest" | "pending" | "future" | "before" };

/** Calendar for the last `weeks` weeks (Monday-first columns) for the history heatmap. */
export function habitCalendar(
  s: HabitSchedule,
  completions: Iterable<QuestDate>,
  startDate: QuestDate,
  today: QuestDate,
  weeks = 12,
): HeatCell[][] {
  const done = new Set(completions);
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(first, w * 7 + i);
      let state: HeatCell["state"];
      if (date > today) state = "future";
      else if (done.has(date)) state = "done";
      else if (date < startDate) state = "before";
      else if (date === today) state = "pending";
      else if (s.kind === "weekly") state = "rest"; // any-day habits have no specific missed days
      else state = isScheduledDay(s, date) ? "missed" : "rest";
      return { date, state };
    }),
  );
}
