import { TZDate } from "@date-fns/tz";

// All "quest day" logic lives here. A quest day is the player's local calendar date,
// shifted so it begins at `dayStartHour` (e.g. 4 → 04:00 to 03:59 next morning).
// The server's own time zone is never consulted.

export type QuestDate = string; // YYYY-MM-DD

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function wallClock(now: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

export function addDays(date: QuestDate, days: number): QuestDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The player's quest day at instant `now`. */
export function questDay(now: Date, tz: string, dayStartHour: number): QuestDate {
  const { year, month, day, hour } = wallClock(now, tz);
  const calendar = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return hour < dayStartHour ? addDays(calendar, -1) : calendar;
}

/** UTC instants bounding a quest day: [start, end). */
export function questDayBounds(date: QuestDate, tz: string, dayStartHour: number) {
  const at = (d: QuestDate) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(new TZDate(y, m - 1, day, dayStartHour, 0, 0, tz).getTime());
  };
  return { start: at(date), end: at(addDays(date, 1)) };
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function dayOfWeek(date: QuestDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Monday of the week containing `date` (weeks run Monday–Sunday). */
export function weekStart(date: QuestDate): QuestDate {
  const dow = dayOfWeek(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}
