import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notification, playerProgress, user, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { LIMITS } from "@/lib/progression/config";
import { checkProgressConsistency } from "@/server/services/consistency";
import { createPlayer } from "@/server/services/player";
import { ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { grantXp, type XpGrant } from "@/server/services/rewards";
import { createPgTestDb } from "./pg-helpers";

const pg = await createPgTestDb();
let db: AppDb;
beforeAll(() => {
  if (pg) db = pg.db;
});
afterAll(async () => pg?.close());

const NOON = new Date("2026-10-27T11:00:00Z");

async function newPlayer() {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Racer", email: `${id}@example.test` });
  await createPlayer(
    db,
    id,
    { displayName: "Racer", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas: [], preferredDifficulty: "normal", dailyTarget: null },
    NOON,
  );
  return id;
}

const grant = (userId: string, key: string, amount: number): XpGrant => ({
  userId,
  eventType: "quest_completed",
  sourceType: "player_quest",
  amount,
  reason: "race",
  idempotencyKey: key,
  now: NOON,
});

describe.skipIf(!pg)("concurrent requests against real Postgres", () => {
  it("awards a reward exactly once when the same request arrives 25 times at once", async () => {
    const userId = await newPlayer();
    const key = `quest:${crypto.randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 25 }, () => db.transaction((tx) => grantXp(tx, grant(userId, key, 100)))),
    );
    expect(results.filter((r) => r.status === "granted")).toHaveLength(1);
    expect((await db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) }))?.totalXp).toBe(100);
    expect(await db.query.xpLedger.findMany({ where: eq(xpLedger.idempotencyKey, key) })).toHaveLength(1);
    // Crossing level 2 produced exactly one notification.
    const notes = await db.query.notification.findMany({ where: eq(notification.userId, userId) });
    expect(notes.filter((n) => n.type === "level_up")).toHaveLength(1);
  });

  it("never exceeds the daily cap under parallel different grants", async () => {
    const userId = await newPlayer();
    await Promise.all(
      Array.from({ length: 30 }, () =>
        db.transaction((tx) => grantXp(tx, grant(userId, `quest:${crypto.randomUUID()}`, 25))),
      ),
    );
    const report = await checkProgressConsistency(db, userId);
    expect(report.ledgerXp).toBe(LIMITS.dailyQuestXpCap);
    expect(report.ok).toBe(true);
  });

  it("keeps totals consistent across many parallel uncapped grants", async () => {
    const userId = await newPlayer();
    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        db.transaction((tx) =>
          grantXp(tx, {
            userId,
            eventType: "achievement_unlocked",
            sourceType: "test",
            amount: 37,
            reason: "parallel",
            idempotencyKey: `ach:${userId}:${i}`,
            now: NOON,
          }),
        ),
      ),
    );
    const report = await checkProgressConsistency(db, userId);
    expect(report).toMatchObject({ ok: true, ledgerXp: 40 * 37 });
  });

  it("does not duplicate daily quests when many requests generate them at once", async () => {
    const userId = await newPlayer();
    const next = new Date("2026-10-28T11:00:00Z");
    await Promise.all(Array.from({ length: 15 }, () => ensureDailyQuests(db, userId, next)));
    const quests = await listQuestsForDay(db, userId, "2026-10-28");
    expect(quests.length).toBeGreaterThan(0);
    expect(new Set(quests.map((q) => q.templateId)).size).toBe(quests.length);
  });
});
