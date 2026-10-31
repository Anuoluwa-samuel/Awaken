import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  auditEvent,
  levelEvent,
  notification,
  playerAttribute,
  playerProgress,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { LIMITS } from "@/lib/progression/config";
import { xpToReach } from "@/lib/progression/levels";
import { checkProgressConsistency, rebuildProgress } from "@/server/services/consistency";
import { createPlayer } from "@/server/services/player";
import { grantAttribute, grantXp, RewardError, type XpGrant } from "@/server/services/rewards";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

// Lagos is UTC+1 all year; with dayStartHour 4 a quest day starts at 03:00 UTC.
const NOON = new Date("2026-10-27T11:00:00Z");

async function newPlayer() {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    {
      displayName: "Player",
      timeZone: "Africa/Lagos",
      dayStartHour: 4,
      focusAreas: [],
      preferredDifficulty: "normal",
      dailyTarget: null,
    },
    NOON,
  );
  return userId;
}

function quest(userId: string, key: string, amount = 25, now = NOON): XpGrant {
  return {
    userId,
    eventType: "quest_completed",
    sourceType: "player_quest",
    sourceId: key,
    amount,
    reason: `Quest ${key}`,
    idempotencyKey: `quest:${key}`,
    now,
  };
}

const progressOf = (userId: string) =>
  db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });

describe("grantXp", () => {
  it("records a ledger entry and updates the cached totals", async () => {
    const userId = await newPlayer();
    const result = await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID())));
    expect(result).toMatchObject({ status: "granted", requested: 25, granted: 25, capReason: null });
    expect(await progressOf(userId)).toMatchObject({ totalXp: 25, level: 1, rank: "E" });
    expect(await db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) })).toHaveLength(1);
  });

  it("grants exactly once for repeated idempotency keys", async () => {
    const userId = await newPlayer();
    const g = quest(userId, crypto.randomUUID());
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await db.transaction((tx) => grantXp(tx, g)));
    expect(results.filter((r) => r.status === "granted")).toHaveLength(1);
    expect(results.filter((r) => r.status === "duplicate")).toHaveLength(4);
    expect((await progressOf(userId))?.totalXp).toBe(25);
  });

  it("levels up at the exact threshold and records one level event", async () => {
    const userId = await newPlayer();
    await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 99)));
    expect((await progressOf(userId))?.level).toBe(1);
    const r = await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 1)));
    expect(r.status === "granted" && r.change).toMatchObject({ fromLevel: 1, toLevel: 2, skillPointsGained: 1 });
    expect(await progressOf(userId)).toMatchObject({ totalXp: 100, level: 2, skillPointsEarned: 1 });
    expect(await db.query.levelEvent.findMany({ where: eq(levelEvent.userId, userId) })).toHaveLength(1);
  });

  it("handles multiple level-ups and rank-ups from one uncapped reward", async () => {
    const userId = await newPlayer();
    const r = await db.transaction((tx) =>
      grantXp(tx, {
        userId,
        eventType: "achievement_unlocked",
        sourceType: "achievement",
        amount: xpToReach(10),
        reason: "Test achievement",
        idempotencyKey: `ach:${userId}:big`,
        now: NOON,
      }),
    );
    expect(r.status === "granted" && r.change).toMatchObject({ fromLevel: 1, toLevel: 10, toRank: "D", rankChanged: true });
    expect(await progressOf(userId)).toMatchObject({ level: 10, rank: "D", skillPointsEarned: 9 });

    const events = await db.query.levelEvent.findMany({ where: eq(levelEvent.userId, userId) });
    expect(events).toMatchObject([{ fromLevel: 1, toLevel: 10, fromRank: "E", toRank: "D" }]);
    const notes = await db.query.notification.findMany({ where: eq(notification.userId, userId) });
    expect(notes.map((n) => n.type).filter((t) => t === "level_up" || t === "rank_up").sort()).toEqual(["level_up", "rank_up"]);
  });

  it("applies the daily quest cap, records the capped grant, and explains it", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < 3; i++) await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 100)));
    const partial = await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 150)));
    expect(partial).toMatchObject({ status: "granted", requested: 150, granted: 100 });
    expect(partial.status === "granted" && partial.capReason).toMatch(/50 XP not awarded/);

    const zero = await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 25)));
    expect(zero).toMatchObject({ status: "granted", granted: 0 });
    expect((await progressOf(userId))?.totalXp).toBe(LIMITS.dailyQuestXpCap);

    // Achievements are not capped.
    await db.transaction((tx) =>
      grantXp(tx, {
        userId,
        eventType: "achievement_unlocked",
        sourceType: "achievement",
        amount: 10,
        reason: "First Blood",
        idempotencyKey: `ach:${userId}:first-blood`,
        now: NOON,
      }),
    );
    expect((await progressOf(userId))?.totalXp).toBe(LIMITS.dailyQuestXpCap + 10);
  });

  it("resets the cap at the player's day boundary, not UTC midnight", async () => {
    const userId = await newPlayer();
    await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 400)));
    // 02:59 UTC on the 28th = 03:59 Lagos: still the 27th's quest day.
    const before = await db.transaction((tx) =>
      grantXp(tx, quest(userId, crypto.randomUUID(), 25, new Date("2026-10-28T02:59:00Z"))),
    );
    expect(before).toMatchObject({ granted: 0 });
    const after = await db.transaction((tx) =>
      grantXp(tx, quest(userId, crypto.randomUUID(), 25, new Date("2026-10-28T03:00:00Z"))),
    );
    expect(after).toMatchObject({ granted: 25 });
  });

  it("rejects negative or fractional amounts", async () => {
    const userId = await newPlayer();
    await expect(db.transaction((tx) => grantXp(tx, quest(userId, "neg", -10)))).rejects.toBeInstanceOf(RewardError);
    await expect(db.transaction((tx) => grantXp(tx, quest(userId, "frac", 2.5)))).rejects.toBeInstanceOf(RewardError);
    expect((await progressOf(userId))?.totalXp).toBe(0);
  });

  it("fails for a user without a player", async () => {
    const userId = await createUser(db);
    await expect(db.transaction((tx) => grantXp(tx, quest(userId, "x")))).rejects.toMatchObject({
      code: "PLAYER_NOT_FOUND",
    });
  });

  it("rolls back the grant when the surrounding action fails", async () => {
    const userId = await newPlayer();
    const key = crypto.randomUUID();
    await expect(
      db.transaction(async (tx) => {
        await grantXp(tx, quest(userId, key, 50));
        throw new Error("completion failed");
      }),
    ).rejects.toThrow("completion failed");
    expect((await progressOf(userId))?.totalXp).toBe(0);
    // The key was not consumed, so a successful retry still pays out.
    expect(await db.transaction((tx) => grantXp(tx, quest(userId, key, 50)))).toMatchObject({ granted: 50 });
  });

  it("keeps players isolated", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await db.transaction((tx) => grantXp(tx, quest(a, crypto.randomUUID(), 50)));
    expect((await progressOf(b))?.totalXp).toBe(0);
  });
});

describe("grantAttribute", () => {
  it("adds points once per key and caps per attribute per day", async () => {
    const userId = await newPlayer();
    const grant = (key: string, amount: number, attribute: "strength" | "creativity" = "strength") =>
      db.transaction((tx) =>
        grantAttribute(tx, { userId, attribute, amount, sourceType: "test", idempotencyKey: key, now: NOON }),
      );
    expect(await grant(`a:${userId}:1`, 5)).toMatchObject({ status: "granted", granted: 5 });
    expect(await grant(`a:${userId}:1`, 5)).toEqual({ status: "duplicate" });
    expect(await grant(`a:${userId}:2`, 7)).toMatchObject({ granted: 5, capReason: expect.stringMatching(/Strength/) });
    expect(await grant(`a:${userId}:3`, 3)).toMatchObject({ granted: 0 });
    expect(await grant(`a:${userId}:4`, 3, "creativity")).toMatchObject({ granted: 3 });

    const attrs = await db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) });
    expect(Object.fromEntries(attrs.map((a) => [a.attribute, a.points]))).toMatchObject({
      strength: LIMITS.dailyAttributeCap,
      creativity: 3,
    });
  });
});

describe("consistency", () => {
  it("reports consistent caches after normal grants", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < 6; i++) await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 50)));
    await db.transaction((tx) =>
      grantAttribute(tx, { userId, attribute: "discipline", amount: 2, sourceType: "test", idempotencyKey: `d:${userId}`, now: NOON }),
    );
    const report = await checkProgressConsistency(db, userId);
    expect(report).toMatchObject({ ok: true, ledgerXp: 300, cachedXp: 300, expectedLevel: 3 });
  });

  it("detects drift and rebuilds caches from the ledgers with an audit trail", async () => {
    const userId = await newPlayer();
    await db.transaction((tx) => grantXp(tx, quest(userId, crypto.randomUUID(), 100)));
    // Simulate a bad manual edit to the caches.
    await db.update(playerProgress).set({ totalXp: 9999, level: 40, rank: "B" }).where(eq(playerProgress.userId, userId));
    await db
      .update(playerAttribute)
      .set({ points: 77 })
      .where(and(eq(playerAttribute.userId, userId), eq(playerAttribute.attribute, "vitality")));

    const drift = await checkProgressConsistency(db, userId);
    expect(drift.ok).toBe(false);
    expect(drift.attributeMismatches).toEqual([{ attribute: "vitality", ledger: 0, cached: 77 }]);

    const after = await rebuildProgress(db, userId, null);
    expect(after.ok).toBe(true);
    expect(await progressOf(userId)).toMatchObject({ totalXp: 100, level: 2, rank: "E" });
    const audits = await db.query.auditEvent.findMany({ where: eq(auditEvent.targetId, userId) });
    expect(audits.map((a) => a.action)).toContain("progress.rebuilt");
  });

  it("is a no-op when nothing drifted", async () => {
    const userId = await newPlayer();
    expect((await rebuildProgress(db, userId, null)).ok).toBe(true);
    const audits = await db.query.auditEvent.findMany({
      where: and(eq(auditEvent.targetId, userId), eq(auditEvent.action, "progress.rebuilt")),
    });
    expect(audits).toHaveLength(0);
  });
});
