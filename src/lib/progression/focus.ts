import { FOCUS_RULES } from "./config";

// Focus timing — docs/ARCHITECTURE.md §6e. Elapsed time is derived from server timestamps,
// never from a client countdown, so refreshes and clock games can't change it.
// Paused time never counts as focus time.

export type FocusTiming = {
  startedAt: Date;
  pausedAt: Date | null;
  totalPausedSeconds: number;
  plannedSeconds: number;
};

const secondsBetween = (a: Date, b: Date) => Math.max(0, Math.floor((b.getTime() - a.getTime()) / 1000));

export function focusElapsedSeconds(s: FocusTiming, now: Date): number {
  const paused = s.totalPausedSeconds + (s.pausedAt ? secondsBetween(s.pausedAt, now) : 0);
  return Math.max(0, secondsBetween(s.startedAt, now) - paused);
}

export function focusRemainingSeconds(s: FocusTiming, now: Date): number {
  return Math.max(0, s.plannedSeconds - focusElapsedSeconds(s, now));
}

/** A session is "full" once its focused time reaches the plan (within a small tolerance). */
export function isFullSession(s: FocusTiming, now: Date): boolean {
  return focusElapsedSeconds(s, now) >= s.plannedSeconds - FOCUS_RULES.completionToleranceSeconds;
}

export function creditedSeconds(s: FocusTiming, now: Date): number {
  return Math.min(s.plannedSeconds, focusElapsedSeconds(s, now));
}

export function focusXp(plannedSeconds: number): number {
  const minutes = plannedSeconds / 60;
  return minutes < FOCUS_RULES.minMinutes ? 0 : Math.round(minutes * FOCUS_RULES.xpPerMinute);
}

export type DurationCheck = { ok: true } | { ok: false; reason: string };

export function checkFocusMinutes(minutes: number, hasDeepFocus: boolean): DurationCheck {
  if (!Number.isInteger(minutes)) return { ok: false, reason: "Use whole minutes." };
  if (minutes < FOCUS_RULES.minMinutes) return { ok: false, reason: `Sessions are at least ${FOCUS_RULES.minMinutes} minutes.` };
  const max = hasDeepFocus ? FOCUS_RULES.maxDeepMinutes : FOCUS_RULES.maxBaseMinutes;
  if (minutes > max) {
    return {
      ok: false,
      reason: hasDeepFocus
        ? `Sessions are at most ${FOCUS_RULES.maxDeepMinutes} minutes.`
        : `Sessions over ${FOCUS_RULES.maxBaseMinutes} minutes need the Deep Focus skill.`,
    };
  }
  return { ok: true };
}

/** Suggested break after the n-th completed session today (1-based). */
export function breakAfter(completedToday: number): { kind: "short" | "long"; minutes: number } {
  return completedToday > 0 && completedToday % FOCUS_RULES.longBreakEvery === 0
    ? { kind: "long", minutes: FOCUS_RULES.longBreakMinutes }
    : { kind: "short", minutes: FOCUS_RULES.shortBreakMinutes };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
