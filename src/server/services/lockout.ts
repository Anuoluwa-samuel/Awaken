import { and, eq, isNull, lt } from "drizzle-orm";
import { authLockout, user } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { LOCKOUT, lockMinutes } from "@/lib/auth/lockout-rules";
import { notify } from "./notifications";

// Per-account sign-in lockout — docs/ARCHITECTURE.md §6g.
//
// 1. Before the password is checked, `reserveAttempt` counts the attempt under a row lock.
//    The 6th attempt (counting ones still in flight) is refused and locks the account, so
//    firing many guesses in parallel can't slip extra ones in.
// 2. A wrong password (`recordFailure`) on the 5th counted attempt locks the account for
//    10 minutes; each consecutive lock doubles (20, 40 … up to 24 h).
// 3. A successful sign-in or password reset (`clearLockout`) resets everything.
// 4. After a lock expires the player gets a fresh 5 attempts; the escalation level only resets
//    after 24 h without attempts or on success.

export type AttemptDecision =
  | { allowed: true; attempts: number }
  | { allowed: false; lockedUntil: Date; retryAfterSeconds: number; level: number };

const secondsUntil = (d: Date, now: Date) => Math.max(1, Math.ceil((d.getTime() - now.getTime()) / 1000));

async function lockRow(tx: AppDb, email: string, now: Date) {
  await tx.insert(authLockout).values({ email, lastAttemptAt: now }).onConflictDoNothing();
  const [row] = await tx.select().from(authLockout).where(eq(authLockout.email, email)).for("update");
  return row;
}

async function applyLock(tx: AppDb, email: string, level: number, now: Date) {
  const lockedUntil = new Date(now.getTime() + lockMinutes(level) * 60_000);
  await tx
    .update(authLockout)
    .set({ attempts: 0, level, lockedUntil, lastAttemptAt: now })
    .where(eq(authLockout.email, email));
  // Tell the owner, if this address has an account (no-op otherwise — nothing is revealed).
  const owner = await tx.query.user.findFirst({ where: eq(user.email, email), columns: { id: true } });
  if (owner) {
    await notify(tx, {
      userId: owner.id,
      type: "system",
      title: "Sign-in locked",
      body: `${LOCKOUT.maxAttempts} wrong passwords were entered for your account, so sign-in was paused for ${lockMinutes(level)} minutes. If this wasn't you, change your password.`,
      href: "/system/settings",
      dedupeKey: `lockout:${owner.id}:${lockedUntil.toISOString()}`,
      createdAt: now,
    });
  }
  return { allowed: false as const, lockedUntil, retryAfterSeconds: secondsUntil(lockedUntil, now), level };
}

/** Counts a sign-in attempt before the password is verified; refuses it while locked. */
export async function reserveAttempt(db: AppDb, email: string, now = new Date()): Promise<AttemptDecision> {
  return db.transaction(async (tx) => {
    const row = await lockRow(tx, email, now);
    if (row.lockedUntil && row.lockedUntil > now) {
      return { allowed: false, lockedUntil: row.lockedUntil, retryAfterSeconds: secondsUntil(row.lockedUntil, now), level: row.level };
    }
    const idle = now.getTime() - row.lastAttemptAt.getTime() > LOCKOUT.levelResetHours * 3_600_000;
    let attempts = row.lockedUntil ? 0 : row.attempts; // a fresh set of tries after a lock expires
    let level = row.level;
    if (idle) {
      attempts = 0;
      level = 0;
    }
    if (attempts >= LOCKOUT.maxAttempts) return applyLock(tx, email, level + 1, now);
    attempts += 1;
    await tx
      .update(authLockout)
      .set({ attempts, level, lockedUntil: null, lastAttemptAt: now })
      .where(eq(authLockout.email, email));
    return { allowed: true, attempts };
  });
}

/** A wrong password: locks the account when this was the last allowed attempt. */
export async function recordFailure(db: AppDb, email: string, now = new Date()): Promise<AttemptDecision | null> {
  return db.transaction(async (tx) => {
    const row = await lockRow(tx, email, now);
    if (row.lockedUntil && row.lockedUntil > now) return null; // already locked by a parallel attempt
    if (row.attempts >= LOCKOUT.maxAttempts) return applyLock(tx, email, row.level + 1, now);
    return null;
  });
}

/** Successful sign-in or password reset. */
export async function clearLockout(db: AppDb, email: string) {
  await db
    .update(authLockout)
    .set({ attempts: 0, level: 0, lockedUntil: null })
    .where(eq(authLockout.email, email));
}

export async function lockoutStatus(db: AppDb, email: string, now = new Date()) {
  const row = await db.query.authLockout.findFirst({ where: eq(authLockout.email, email) });
  return row && row.lockedUntil && row.lockedUntil > now
    ? { locked: true as const, lockedUntil: row.lockedUntil, retryAfterSeconds: secondsUntil(row.lockedUntil, now) }
    : { locked: false as const, attempts: row?.attempts ?? 0 };
}

/** Housekeeping: rows for idle, unlocked addresses (e.g. sprayed fake emails). */
export async function pruneLockouts(db: AppDb, olderThan: Date) {
  await db.delete(authLockout).where(and(isNull(authLockout.lockedUntil), lt(authLockout.lastAttemptAt, olderThan)));
}

/** Wrong passwords counted so far for this email, for deciding when to ask for a captcha. */
export async function failedSignIns(db: AppDb, email: string) {
  const row = await db.query.authLockout.findFirst({ where: eq(authLockout.email, email), columns: { attempts: true } });
  return row?.attempts ?? 0;
}
