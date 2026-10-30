import { describe, expect, it } from "vitest";
import {
  breakAfter,
  checkFocusMinutes,
  creditedSeconds,
  focusElapsedSeconds,
  focusRemainingSeconds,
  focusXp,
  formatClock,
  isFullSession,
} from "@/lib/progression/focus";
import { goalProgress, goalRewardCheck, goalRewardXp } from "@/lib/progression/goals";

const t0 = new Date("2026-10-31T10:00:00Z");
const after = (s: number) => new Date(t0.getTime() + s * 1000);
const base = { startedAt: t0, pausedAt: null, totalPausedSeconds: 0, plannedSeconds: 25 * 60 };

describe("focus timing", () => {
  it("derives elapsed and remaining from timestamps", () => {
    expect(focusElapsedSeconds(base, after(600))).toBe(600);
    expect(focusRemainingSeconds(base, after(600))).toBe(900);
    expect(focusRemainingSeconds(base, after(5000))).toBe(0);
  });

  it("excludes paused time, both finished and ongoing pauses", () => {
    const resumed = { ...base, totalPausedSeconds: 300 };
    expect(focusElapsedSeconds(resumed, after(900))).toBe(600);
    const pausedNow = { ...base, pausedAt: after(600) };
    expect(focusElapsedSeconds(pausedNow, after(3600))).toBe(600); // frozen while paused
  });

  it("treats a session as full only at the planned length (with tiny tolerance)", () => {
    expect(isFullSession(base, after(1500 - 10))).toBe(false);
    expect(isFullSession(base, after(1500 - 2))).toBe(true);
    expect(isFullSession({ ...base, totalPausedSeconds: 60 }, after(1500))).toBe(false);
  });

  it("never credits more than planned", () => {
    expect(creditedSeconds(base, after(99_999))).toBe(1500);
    expect(creditedSeconds(base, after(-60))).toBe(0); // clock skew can't go negative
  });

  it("awards XP proportionally to planned length", () => {
    expect(focusXp(25 * 60)).toBe(10);
    expect(focusXp(15 * 60)).toBe(6);
    expect(focusXp(50 * 60)).toBe(20);
    expect(focusXp(90 * 60)).toBe(36);
    expect(focusXp(5 * 60)).toBe(0);
  });

  it("validates durations, with Deep Focus extending the maximum", () => {
    expect(checkFocusMinutes(25, false)).toEqual({ ok: true });
    expect(checkFocusMinutes(9, false).ok).toBe(false);
    expect(checkFocusMinutes(50, false)).toEqual({ ok: false, reason: "Sessions over 45 minutes need the Deep Focus skill." });
    expect(checkFocusMinutes(50, true)).toEqual({ ok: true });
    expect(checkFocusMinutes(91, true).ok).toBe(false);
    expect(checkFocusMinutes(25.5, true).ok).toBe(false);
  });

  it("suggests a long break every fourth session", () => {
    expect(breakAfter(1)).toEqual({ kind: "short", minutes: 5 });
    expect(breakAfter(4)).toEqual({ kind: "long", minutes: 15 });
    expect(breakAfter(8).kind).toBe("long");
  });

  it("formats clocks", () => {
    expect(formatClock(1500)).toBe("25:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(5400)).toBe("1:30:00");
  });
});

describe("goals", () => {
  it("computes progress from milestones only", () => {
    expect(goalProgress([])).toEqual({ done: 0, total: 0, ratio: 0, complete: false });
    const d = new Date();
    expect(goalProgress([{ completedAt: d }, { completedAt: null }])).toMatchObject({ done: 1, ratio: 0.5, complete: false });
    expect(goalProgress([{ completedAt: d }, { completedAt: d }]).complete).toBe(true);
  });

  it("caps the reward and explains ineligibility", () => {
    expect(goalRewardXp(3)).toBe(30);
    expect(goalRewardXp(30)).toBe(100);
    const ok = { milestoneCount: 3, startDate: "2026-10-20", today: "2026-10-31", rewardedToday: 0 };
    expect(goalRewardCheck(ok)).toEqual({ eligible: true, xp: 30 });
    expect(goalRewardCheck({ ...ok, milestoneCount: 1 }).eligible).toBe(false);
    expect(goalRewardCheck({ ...ok, startDate: "2026-10-31" })).toMatchObject({ eligible: false, reason: expect.stringMatching(/created/) });
    expect(goalRewardCheck({ ...ok, rewardedToday: 2 }).eligible).toBe(false);
  });
});
