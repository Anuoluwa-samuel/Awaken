import "server-only";
import { db } from "@/db";
import { ACTION_RATE, quotaMessage, RATE_LIMITED_MESSAGE, type QuotaMetric } from "@/lib/limits";
import { consumeQuota, countSiteEvent, hitRateLimit } from "@/server/services/limits";

/** Call first in every server action. Returns a message to show the player if they're over the limit. */
export async function guardAction(userId: string): Promise<string | null> {
  const { allowed } = await hitRateLimit(db, `actions:${userId}`, ACTION_RATE);
  if (allowed) return null;
  await countSiteEvent(db, "rate_limited");
  return RATE_LIMITED_MESSAGE;
}

/** Call in actions that create something, once the input is valid. Returns a message when used up. */
export async function guardQuota(userId: string, metric: QuotaMetric): Promise<string | null> {
  if (await consumeQuota(db, userId, metric)) return null;
  await countSiteEvent(db, "quota_reached");
  return quotaMessage(metric);
}
