// Account lockout policy — pure, unit-tested. See docs/ARCHITECTURE.md §6g.

export const LOCKOUT = {
  /** Wrong passwords allowed before the account locks. */
  maxAttempts: 5,
  /** First lock; each further lock doubles it… */
  baseMinutes: 10,
  /** …up to this cap. */
  maxMinutes: 24 * 60,
  /** With no attempts for this long, the escalation level resets to zero. */
  levelResetHours: 24,
} as const;

/** Lock duration for the n-th consecutive lock (1-based): 10, 20, 40, 80 … minutes, capped. */
export function lockMinutes(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`level must be ≥ 1, got ${level}`);
  return Math.min(LOCKOUT.maxMinutes, LOCKOUT.baseMinutes * 2 ** (level - 1));
}

export function normaliseEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.length > 0 && e.length <= 320 ? e : null;
}

export function describeWait(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${h} hour${h === 1 ? "" : "s"}${rest ? ` ${rest} min` : ""}`;
}
