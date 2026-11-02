import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authLockout, notification, rateLimit, session, usageCounter, user, verification, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { DAILY_QUOTAS, quotaMessage } from "@/lib/limits";
import { purgeAccountExtras } from "@/server/services/account";
import { consumeDaily, consumeQuota, countSiteEvent, getQuotaUsage, getSiteUsage, hitRateLimit } from "@/server/services/limits";
import { failedSignIns, recordFailure, reserveAttempt } from "@/server/services/lockout";
import { runMaintenance } from "@/server/services/maintenance";
import { createPlayer } from "@/server/services/player";
import { grantXp } from "@/server/services/rewards";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const T0 = new Date("2026-11-02T10:00:00Z");
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const scope = () => crypto.randomUUID();

describe("hitRateLimit", () => {
  const rule = { windowSeconds: 60, max: 3 };

  it("allows up to the maximum, then says how long to wait", async () => {
    const key = scope();
    for (let i = 0; i < 3; i++) expect((await hitRateLimit(db, key, rule, after(i))).allowed).toBe(true);
    expect(await hitRateLimit(db, key, rule, after(10))).toEqual({ allowed: false, retryAfterSeconds: 50 });
  });

  it("starts a fresh window, and keeps keys apart", async () => {
    const key = scope();
    for (let i = 0; i < 4; i++) await hitRateLimit(db, key, rule, T0);
    expect((await hitRateLimit(db, scope(), rule, T0)).allowed).toBe(true);
    expect((await hitRateLimit(db, key, rule, after(61))).allowed).toBe(true);
  });
});

describe("daily quotas", () => {
  it("stop at the limit and reset the next UTC day", async () => {
    const id = scope();
    expect(await consumeDaily(db, id, "m", 2, T0)).toBe(true);
    expect(await consumeDaily(db, id, "m", 2, T0)).toBe(true);
    expect(await consumeDaily(db, id, "m", 2, T0)).toBe(false);
    expect(await consumeDaily(db, id, "m", 2, new Date("2026-11-03T00:00:00Z"))).toBe(true);
  });

  it("treat a limit of 0 as switched off", async () => {
    expect(await consumeDaily(db, scope(), "m", 0, T0)).toBe(false);
  });

  it("report a player's usage, and never mention XP as limited", async () => {
    const id = scope();
    await consumeQuota(db, id, "habits_created", T0);
    const usage = await getQuotaUsage(db, id, T0);
    expect(usage.find((u) => u.metric === "habits_created")).toMatchObject({ used: 1, limit: DAILY_QUOTAS.habits_created.limit });
    expect(usage.find((u) => u.metric === "goals_created")?.used).toBe(0);
    expect(quotaMessage("habits_created")).toContain("midnight UTC");
    expect(Object.keys(DAILY_QUOTAS).join()).not.toMatch(/xp|quest_complet|checkin/i);
  });

  it("count site events", async () => {
    const day = new Date("2031-01-01T00:00:00Z");
    await countSiteEvent(db, "rate_limited", day);
    await countSiteEvent(db, "rate_limited", day);
    expect((await getSiteUsage(db, day)).rate_limited).toBe(2);
  });

  it("are deleted with the account", async () => {
    const userId = await createUser(db);
    await consumeQuota(db, userId, "goals_created", T0);
    await purgeAccountExtras(db, userId, `${userId}@example.test`);
    expect(await db.select().from(usageCounter).where(eq(usageCounter.scope, userId))).toEqual([]);
  });
});

describe("failedSignIns", () => {
  it("counts wrong passwords for the captcha decision", async () => {
    const email = `cap${Date.now()}@awaken.test`;
    expect(await failedSignIns(db, email)).toBe(0);
    await reserveAttempt(db, email, T0);
    await recordFailure(db, email, T0);
    await reserveAttempt(db, email, T0);
    expect(await failedSignIns(db, email)).toBe(2);
  });
});

describe("daily maintenance", () => {
  const NOW = new Date("2027-06-01T03:00:00Z");
  const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

  it("clears expired bookkeeping and keeps everything a player would miss", async () => {
    const userId = await createUser(db);
    await createPlayer(db, userId, { displayName: "Keeper", timeZone: "UTC", dayStartHour: 4, focusAreas: [], preferredDifficulty: "normal", dailyTarget: null }, ago(400));
    await db.transaction((tx) =>
      grantXp(tx, { userId, eventType: "quest_completed", sourceType: "test", amount: 25, reason: "old", idempotencyKey: `old:${userId}`, now: ago(400) }),
    );

    const stale = crypto.randomUUID();
    const fresh = crypto.randomUUID();
    await db.insert(rateLimit).values([
      { key: `old-${stale}`, count: 1, lastRequest: ago(2).getTime() },
      { key: `new-${fresh}`, count: 1, lastRequest: NOW.getTime() - 1000 },
    ]);
    await db.insert(usageCounter).values([
      { scope: stale, metric: "m", day: "2027-03-01", count: 1 },
      { scope: fresh, metric: "m", day: "2027-05-20", count: 1 },
    ]);
    await db.insert(verification).values([
      { id: stale, identifier: "x", value: "y", expiresAt: ago(1) },
      { id: fresh, identifier: "x", value: "y", expiresAt: new Date(NOW.getTime() + 60_000) },
    ]);
    await db.insert(session).values([
      { id: stale, token: stale, userId, expiresAt: ago(1), updatedAt: ago(20) },
      { id: fresh, token: fresh, userId, expiresAt: new Date(NOW.getTime() + 60_000), updatedAt: NOW },
    ]);
    await db.insert(notification).values([
      { id: stale, userId, type: "level_up", title: "old read", body: "x", dedupeKey: stale, readAt: ago(100), createdAt: ago(120) },
      { id: fresh, userId, type: "level_up", title: "old unread", body: "x", dedupeKey: fresh, createdAt: ago(120) },
    ]);
    await db.insert(authLockout).values([
      { email: `${stale}@x.test`, attempts: 1, level: 0, lastAttemptAt: ago(40) },
      { email: `${fresh}@x.test`, attempts: 1, level: 0, lastAttemptAt: ago(1) },
    ]);

    const removed = await runMaintenance(db, NOW);
    expect(removed.rateLimits).toBeGreaterThanOrEqual(1);
    expect(removed.notifications).toBe(1);

    const has = async (rows: unknown[]) => rows.length;
    expect(await has(await db.select().from(rateLimit).where(eq(rateLimit.key, `old-${stale}`)))).toBe(0);
    expect(await has(await db.select().from(rateLimit).where(eq(rateLimit.key, `new-${fresh}`)))).toBe(1);
    expect(await has(await db.select().from(usageCounter).where(eq(usageCounter.scope, stale)))).toBe(0);
    expect(await has(await db.select().from(usageCounter).where(eq(usageCounter.scope, fresh)))).toBe(1);
    expect(await has(await db.select().from(verification).where(eq(verification.id, stale)))).toBe(0);
    expect(await has(await db.select().from(verification).where(eq(verification.id, fresh)))).toBe(1);
    expect(await has(await db.select().from(session).where(eq(session.id, stale)))).toBe(0);
    expect(await has(await db.select().from(session).where(eq(session.id, fresh)))).toBe(1);
    expect(await has(await db.select().from(notification).where(eq(notification.id, stale)))).toBe(0);
    expect(await has(await db.select().from(notification).where(eq(notification.id, fresh)))).toBe(1);
    expect(await has(await db.select().from(authLockout).where(eq(authLockout.email, `${stale}@x.test`)))).toBe(0);
    expect(await has(await db.select().from(authLockout).where(eq(authLockout.email, `${fresh}@x.test`)))).toBe(1);

    // XP history and the account are untouched, however old.
    expect(await has(await db.select().from(xpLedger).where(eq(xpLedger.userId, userId)))).toBe(1);
    expect(await has(await db.select().from(user).where(eq(user.id, userId)))).toBe(1);
  });
});
