import { describe, expect, it } from "vitest";
import { addDays, isValidTimeZone, questDay, questDayBounds, weekStart } from "@/lib/time";

describe("questDay", () => {
  it("uses the player's zone, not the server's", () => {
    const instant = new Date("2026-03-10T02:30:00Z");
    expect(questDay(instant, "UTC", 0)).toBe("2026-03-10");
    expect(questDay(instant, "America/New_York", 0)).toBe("2026-03-09"); // 22:30 local
    expect(questDay(instant, "Asia/Tokyo", 0)).toBe("2026-03-10"); // 11:30 local
  });

  it("respects the day-start boundary exactly", () => {
    // Lagos is UTC+1 year-round.
    expect(questDay(new Date("2026-05-02T02:59:59Z"), "Africa/Lagos", 4)).toBe("2026-05-01");
    expect(questDay(new Date("2026-05-02T03:00:00Z"), "Africa/Lagos", 4)).toBe("2026-05-02");
  });

  it("treats midnight as the boundary when dayStartHour is 0", () => {
    expect(questDay(new Date("2026-05-01T23:59:59Z"), "UTC", 0)).toBe("2026-05-01");
    expect(questDay(new Date("2026-05-02T00:00:00Z"), "UTC", 0)).toBe("2026-05-02");
  });

  it("crosses month and year boundaries", () => {
    expect(questDay(new Date("2027-01-01T02:00:00Z"), "UTC", 4)).toBe("2026-12-31");
  });
});

describe("questDayBounds", () => {
  it("returns a 24h window on a normal day", () => {
    const { start, end } = questDayBounds("2026-05-01", "Africa/Lagos", 4);
    expect(start.toISOString()).toBe("2026-05-01T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-02T03:00:00.000Z");
  });

  it("returns a 23h window for the day spanning spring-forward (02:00 on 8 Mar)", () => {
    const { start, end } = questDayBounds("2026-03-07", "America/New_York", 4);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("agrees with questDay at both edges", () => {
    const tz = "America/Los_Angeles";
    const { start, end } = questDayBounds("2026-11-01", tz, 4);
    expect(questDay(start, tz, 4)).toBe("2026-11-01");
    expect(questDay(new Date(end.getTime() - 1), tz, 4)).toBe("2026-11-01");
    expect(questDay(end, tz, 4)).toBe("2026-11-02");
  });
});

describe("helpers", () => {
  it("computes Monday week starts", () => {
    expect(weekStart("2026-10-27")).toBe("2026-10-26"); // Tuesday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // Monday
  });

  it("adds days across leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
