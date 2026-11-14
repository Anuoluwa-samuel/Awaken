import { and, isNotNull, lt } from "drizzle-orm";
import { authLockout, notification, rateLimit, session, usageCounter, verification } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { USAGE_RETENTION_DAYS, utcDay } from "@/lib/limits";
import { pruneLockouts } from "./lockout";

const DAY_MS = 86_400_000;
export const READ_NOTIFICATION_RETENTION_DAYS = 90;
const LOCKOUT_RETENTION_DAYS = 30;

/**
 * Deletes data that has served its purpose, to keep database storage (and its cost) from growing
 * forever. Never touches XP, quests, habits, goals or anything else a player would miss. Runs daily
 * from /api/cron/maintenance and is safe to run repeatedly.
 */
export async function runMaintenance(db: AppDb, now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);

  const rateLimits = await db
    .delete(rateLimit)
    .where(lt(rateLimit.lastRequest, now.getTime() - DAY_MS))
    .returning({ id: rateLimit.id });
  const usage = await db
    .delete(usageCounter)
    .where(lt(usageCounter.day, utcDay(ago(USAGE_RETENTION_DAYS))))
    .returning({ day: usageCounter.day });
  const sessions = await db.delete(session).where(lt(session.expiresAt, now)).returning({ id: session.id });
  const tokens = await db.delete(verification).where(lt(verification.expiresAt, now)).returning({ id: verification.id });
  const notifications = await db
    .delete(notification)
    .where(and(isNotNull(notification.readAt), lt(notification.readAt, ago(READ_NOTIFICATION_RETENTION_DAYS))))
    .returning({ id: notification.id });

  // Lockouts: old finished ones as well as ones that were never locked.
  await pruneLockouts(db, ago(LOCKOUT_RETENTION_DAYS));
  await db
    .delete(authLockout)
    .where(and(lt(authLockout.lockedUntil, now), lt(authLockout.lastAttemptAt, ago(LOCKOUT_RETENTION_DAYS))));

  return {
    rateLimits: rateLimits.length,
    usageCounters: usage.length,
    sessions: sessions.length,
    verifications: tokens.length,
    notifications: notifications.length,
  };
}
