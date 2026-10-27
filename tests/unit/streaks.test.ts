import { describe, expect, it } from "vitest";
import { activeDayStreak } from "@/lib/progression/streaks";

describe("activeDayStreak", () => {
  it("is zero with no activity", () => {
    expect(activeDayStreak([], "2026-10-27")).toBe(0);
  });
  it("counts today and preceding days", () => {
    expect(activeDayStreak(["2026-10-27", "2026-10-26", "2026-10-25"], "2026-10-27")).toBe(3);
  });
  it("does not break because today is unfinished", () => {
    expect(activeDayStreak(["2026-10-26", "2026-10-25"], "2026-10-27")).toBe(2);
  });
  it("breaks on a gap", () => {
    expect(activeDayStreak(["2026-10-27", "2026-10-25"], "2026-10-27")).toBe(1);
    expect(activeDayStreak(["2026-10-25"], "2026-10-27")).toBe(0);
  });
  it("crosses month boundaries", () => {
    expect(activeDayStreak(["2026-11-01", "2026-10-31", "2026-10-30"], "2026-11-01")).toBe(3);
  });
});
