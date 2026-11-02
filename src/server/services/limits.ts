import { and, eq, inArray, sql } from "drizzle-orm";
import { rateLimit, usageCounter } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { DAILY_QUOTAS, type QuotaMetric, utcDay } from "@/lib/limits";

/** Site-wide counters use this scope; per-player counters use the user id. */
export const SITE_SCOPE = "site";

/**
 * A fixed-window limit shared by all server instances. One atomic upsert, so parallel requests can't
 * slip past it. Uses Better Auth's rate_limit table; the "app:" prefix keeps the keys apart.
 */
export async function hitRateLimit(
  db: AppDb,
  key: string,
  { windowSeconds, max }: { windowSeconds: number; max: number },
  now = new Date(),
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const nowMs = now.getTime();
  const cutoff = nowMs - windowSeconds * 1000;
  const [row] = await db
    .insert(rateLimit)
    .values({ key: `app:${key}`, count: 1, lastRequest: nowMs })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when "rate_limit"."last_request" <= ${cutoff}::bigint then 1 else "rate_limit"."count" + 1 end`,
        lastRequest: sql`case when "rate_limit"."last_request" <= ${cutoff}::bigint then ${nowMs}::bigint else "rate_limit"."last_request" end`,
      },
    })
    .returning({ count: rateLimit.count, windowStart: rateLimit.lastRequest });
  if (row.count <= max) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((row.windowStart + windowSeconds * 1000 - nowMs) / 1000)) };
}

/**
 * Takes one unit of a daily allowance. Atomic: the update only applies below the limit, so parallel
 * requests can't overshoot. Returns false once it's used up. A limit of 0 turns the thing off.
 */
export async function consumeDaily(db: AppDb, scope: string, metric: string, limit: number, now = new Date()) {
  if (limit <= 0) return false;
  const rows = await db
    .insert(usageCounter)
    .values({ scope, metric, day: utcDay(now), count: 1 })
    .onConflictDoUpdate({
      target: [usageCounter.scope, usageCounter.metric, usageCounter.day],
      set: { count: sql`"usage_counter"."count" + 1` },
      where: sql`"usage_counter"."count" < ${limit}::int`,
    })
    .returning({ count: usageCounter.count });
  return rows.length > 0;
}

export const consumeQuota = (db: AppDb, userId: string, metric: QuotaMetric, now = new Date()) =>
  consumeDaily(db, userId, metric, DAILY_QUOTAS[metric].limit, now);

/** Adds to a site-wide counter with no limit, for the admin dashboard. */
export async function countSiteEvent(db: AppDb, metric: string, now = new Date()) {
  await db
    .insert(usageCounter)
    .values({ scope: SITE_SCOPE, metric, day: utcDay(now), count: 1 })
    .onConflictDoUpdate({
      target: [usageCounter.scope, usageCounter.metric, usageCounter.day],
      set: { count: sql`"usage_counter"."count" + 1` },
    });
}

/** A player's use of each daily quota today, for the Settings page. */
export async function getQuotaUsage(db: AppDb, userId: string, now = new Date()) {
  const metrics = Object.keys(DAILY_QUOTAS) as QuotaMetric[];
  const rows = await db
    .select({ metric: usageCounter.metric, count: usageCounter.count })
    .from(usageCounter)
    .where(and(eq(usageCounter.scope, userId), eq(usageCounter.day, utcDay(now)), inArray(usageCounter.metric, metrics)));
  const used = new Map(rows.map((row) => [row.metric, row.count]));
  return metrics.map((metric) => ({ metric, ...DAILY_QUOTAS[metric], used: used.get(metric) ?? 0 }));
}

/** Today's site-wide counters, keyed by metric. */
export async function getSiteUsage(db: AppDb, now = new Date()) {
  const rows = await db
    .select({ metric: usageCounter.metric, count: usageCounter.count })
    .from(usageCounter)
    .where(and(eq(usageCounter.scope, SITE_SCOPE), eq(usageCounter.day, utcDay(now))));
  return Object.fromEntries(rows.map((row) => [row.metric, row.count])) as Record<string, number | undefined>;
}
