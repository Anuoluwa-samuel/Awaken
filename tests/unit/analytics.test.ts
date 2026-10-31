import { describe, expect, it } from "vitest";
import { bucketWeekly, cumulative, daysBetween, fillDaily, parseRange, rangeBounds, ratio, shortDate } from "@/lib/analytics";

describe("analytics helpers", () => {
  it("parses ranges with a safe default", () => {
    expect(parseRange("7d")).toBe("7d");
    expect(parseRange("forever")).toBe("30d");
    expect(parseRange(undefined)).toBe("30d");
    expect(parseRange(["7d"])).toBe("30d");
  });

  it("computes inclusive ranges ending today", () => {
    expect(rangeBounds("2026-10-31", "7d")).toEqual({ from: "2026-10-25", to: "2026-10-31" });
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("zero-fills missing days and coerces numeric strings", () => {
    const days = daysBetween("2026-10-29", "2026-10-31");
    const rows = fillDaily(days, [{ date: "2026-10-30", xp: "25" as unknown as number }], ["xp"]);
    expect(rows).toEqual([
      { date: "2026-10-29", xp: 0 },
      { date: "2026-10-30", xp: 25 },
      { date: "2026-10-31", xp: 0 },
    ]);
  });

  it("accumulates from a baseline", () => {
    const rows = [
      { date: "2026-10-30", str: 2 },
      { date: "2026-10-31", str: 3 },
    ];
    expect(cumulative(rows, ["str"], { str: 10 }).map((r) => r.str)).toEqual([12, 15]);
  });

  it("buckets long ranges into weeks without losing totals", () => {
    const rows = daysBetween("2026-10-01", "2026-10-15").map((date) => ({ date, xp: 1 }));
    const weeks = bucketWeekly(rows, ["xp"]);
    expect(weeks.map((w) => w.xp)).toEqual([7, 7, 1]);
    expect(weeks.reduce((s, w) => s + w.xp, 0)).toBe(15);
  });

  it("returns null ratios instead of dividing by zero", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(3, 4)).toBe(0.75);
  });

  it("formats dates without shifting by time zone", () => {
    expect(shortDate("2026-01-01")).toBe("Jan 1");
  });
});

describe("range metrics", () => {
  it("finds the longest run of days", async () => {
    const { longestDayRun } = await import("@/lib/analytics");
    expect(longestDayRun([])).toBe(0);
    expect(longestDayRun(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-02"])).toBe(3);
    expect(longestDayRun(["2026-10-31", "2026-11-01"])).toBe(2);
  });

  it("rates habits inside a window, ignoring pre-start days and unfinished today", async () => {
    const { habitRateInRange } = await import("@/lib/progression/habits");
    const daily = { kind: "days" as const, days: [0, 1, 2, 3, 4, 5, 6] };
    // Window 25–31 Oct, habit started 28th, done 28 & 29, today 31 not done → due 28,29,30 = 3.
    expect(habitRateInRange(daily, ["2026-10-28", "2026-10-29"], "2026-10-28", "2026-10-25", "2026-10-31", "2026-10-31")).toEqual({
      done: 2,
      due: 3,
      rate: 2 / 3,
    });
    // Rest-day check-ins don't inflate the rate.
    const mwf = { kind: "days" as const, days: [1, 3, 5] };
    expect(habitRateInRange(mwf, ["2026-10-26", "2026-10-27"], "2026-10-01", "2026-10-26", "2026-10-28", "2026-10-31").rate).toBe(0.5);
    // Weekly target pro-rated: 2×/week over 14 days → due 4.
    const weekly = { kind: "weekly" as const, timesPerWeek: 2 };
    expect(habitRateInRange(weekly, ["2026-10-14", "2026-10-20", "2026-10-21"], "2026-10-01", "2026-10-14", "2026-10-27", "2026-10-31")).toEqual({
      done: 3,
      due: 4,
      rate: 0.75,
    });
  });
});
