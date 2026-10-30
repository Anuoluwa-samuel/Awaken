import { describe, expect, it } from "vitest";
import {
  checkInCounts,
  describeSchedule,
  habitCalendar,
  habitStats,
  type HabitSchedule,
} from "@/lib/progression/habits";
import { addDays } from "@/lib/time";

// 2026-10-26 is a Monday.
const MWF: HabitSchedule = { kind: "days", days: [1, 3, 5] };
const DAILY: HabitSchedule = { kind: "days", days: [0, 1, 2, 3, 4, 5, 6] };
const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe("days schedule streaks", () => {
  it("does not break on rest days", () => {
    // Mon, Wed, Fri done; today is Sunday (rest) → 3.
    const s = habitStats(MWF, ["2026-10-26", "2026-10-28", "2026-10-30"], "2026-10-01", "2026-11-01");
    expect(s).toMatchObject({ current: 3, unit: "days", scheduledToday: false, doneToday: false });
  });

  it("does not count an unfinished today as missed", () => {
    const s = habitStats(DAILY, range("2026-10-24", 3), "2026-10-01", "2026-10-27");
    expect(s.current).toBe(3);
    expect(habitStats(DAILY, range("2026-10-24", 4), "2026-10-01", "2026-10-27").current).toBe(4);
  });

  it("breaks on a missed scheduled day but keeps the longest run", () => {
    const done = [...range("2026-10-01", 5), ...range("2026-10-08", 2)];
    const s = habitStats(DAILY, done, "2026-10-01", "2026-10-09");
    expect(s).toMatchObject({ current: 2, longest: 5 });
  });

  it("ignores days before the habit started", () => {
    const s = habitStats(DAILY, ["2026-10-27"], "2026-10-27", "2026-10-27");
    expect(s).toMatchObject({ current: 1, longest: 1, rate: 1 });
    expect(habitStats(DAILY, [], "2026-10-27", "2026-10-27").rate).toBeNull();
  });

  it("computes the 30-day completion rate over scheduled days only", () => {
    // MWF from Mon 5 Oct to Fri 30 Oct = 12 scheduled days; 9 done.
    const scheduled = range("2026-10-05", 26).filter((d) => [1, 3, 5].includes(new Date(`${d}T00:00:00Z`).getUTCDay()));
    expect(scheduled).toHaveLength(12);
    const s = habitStats(MWF, scheduled.slice(3), "2026-10-05", "2026-10-30");
    expect(s.rate).toBeCloseTo(9 / 12);
  });

  it("counts only scheduled days toward rewards", () => {
    expect(checkInCounts(MWF, new Set(), "2026-10-26")).toBe(true); // Monday
    expect(checkInCounts(MWF, new Set(), "2026-10-27")).toBe(false); // Tuesday rest day
  });
});

describe("weekly schedule streaks", () => {
  const THREE: HabitSchedule = { kind: "weekly", timesPerWeek: 3 };

  it("counts consecutive weeks that met the target", () => {
    const done = ["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-19", "2026-10-20", "2026-10-25"];
    const s = habitStats(THREE, done, "2026-10-01", "2026-10-27");
    expect(s).toMatchObject({ unit: "weeks", current: 2, thisWeek: 0 });
  });

  it("includes this week once the target is met, and never counts it missed early", () => {
    const done = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-26", "2026-10-27", "2026-10-28"];
    expect(habitStats(THREE, done, "2026-10-19", "2026-10-28").current).toBe(2);
    expect(habitStats(THREE, done.slice(0, 4), "2026-10-19", "2026-10-28")).toMatchObject({ current: 1, thisWeek: 1 });
  });

  it("rewards only up to the weekly target", () => {
    const week = new Set(["2026-10-26", "2026-10-27", "2026-10-28"]);
    expect(checkInCounts(THREE, new Set(["2026-10-26"]), "2026-10-27")).toBe(true);
    expect(checkInCounts(THREE, week, "2026-10-29")).toBe(false);
    // A new week starts over.
    expect(checkInCounts(THREE, week, "2026-11-02")).toBe(true);
  });
});

describe("presentation helpers", () => {
  it("describes schedules", () => {
    expect(describeSchedule(DAILY)).toBe("Every day");
    expect(describeSchedule({ kind: "days", days: [5, 1, 2, 3, 4] })).toBe("Weekdays");
    expect(describeSchedule({ kind: "days", days: [0, 6] })).toBe("Weekends");
    expect(describeSchedule(MWF)).toBe("Mon · Wed · Fri");
    expect(describeSchedule({ kind: "weekly", timesPerWeek: 4 })).toBe("4× per week");
  });

  it("builds a Monday-first calendar with honest states", () => {
    const cal = habitCalendar(MWF, ["2026-10-26"], "2026-10-20", "2026-10-28", 2);
    expect(cal).toHaveLength(2);
    expect(cal[0][0]).toEqual({ date: "2026-10-19", state: "before" });
    expect(cal[0][2]).toEqual({ date: "2026-10-21", state: "missed" }); // Wed, after start
    expect(cal[0][3]).toEqual({ date: "2026-10-22", state: "rest" }); // Thu
    expect(cal[1][0]).toEqual({ date: "2026-10-26", state: "done" });
    expect(cal[1][2]).toEqual({ date: "2026-10-28", state: "pending" });
    expect(cal[1][3].state).toBe("future");
  });
});

describe("weekdayInsights", () => {
  it("rates each scheduled weekday and picks the strongest", async () => {
    const { weekdayInsights } = await import("@/lib/progression/habits");
    // MWF since Mon 12 Oct; all Mondays done, one Wednesday, no Fridays. Today Wed 28th (pending).
    const done = ["2026-10-12", "2026-10-19", "2026-10-26", "2026-10-14"];
    const cal = habitCalendar(MWF, done, "2026-10-12", "2026-10-28", 3);
    const { days, strongest } = weekdayInsights(MWF, cal);
    expect(days.find((d) => d.label === "Mon")).toMatchObject({ done: 3, due: 3 });
    expect(days.find((d) => d.label === "Wed")).toMatchObject({ done: 1, due: 2 });
    expect(days.find((d) => d.label === "Fri")).toMatchObject({ done: 0, due: 2 });
    expect(days.find((d) => d.label === "Tue")).toMatchObject({ done: 0, due: 0 });
    expect(strongest).toBe("Mon");
  });
});
