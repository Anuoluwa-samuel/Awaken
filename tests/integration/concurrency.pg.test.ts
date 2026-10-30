import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notification, playerProgress, questCompletion, user, weeklyChallenge, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { LIMITS } from "@/lib/progression/config";
import { checkProgressConsistency } from "@/server/services/consistency";
import { createPlayer } from "@/server/services/player";
import { completeQuest, createCustomQuest, ensureDailyQuests, listOpenOneOffQuests, listQuestsForDay } from "@/server/services/quests";
import { ensureWeeklyChallenges } from "@/server/services/weekly";
import { grantXp, type XpGrant } from "@/server/services/rewards";
import { createPgTestDb } from "./pg-helpers";

const pg = await createPgTestDb();
let db: AppDb;
beforeAll(() => {
  if (pg) db = pg.db;
});
afterAll(async () => pg?.close());

const NOON = new Date("2026-10-27T11:00:00Z");

async function newPlayer(focusAreas: ("fitness" | "learning")[] = []) {
  const id = crypto.randomUUID();
  await db.insert(user).values({ id, name: "Racer", email: `${id}@example.test` });
  await createPlayer(
    db,
    id,
    { displayName: "Racer", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas, preferredDifficulty: "normal", dailyTarget: null },
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

  it("completes a quest once when 20 completion requests race", async () => {
    const userId = await newPlayer(["learning"]);
    const [quest] = await listQuestsForDay(db, userId, "2026-10-27");
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => completeQuest(db, userId, quest.id, { now: NOON })),
    );
    const fulfilled = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    expect(fulfilled).toHaveLength(20);
    expect(fulfilled.filter((r) => r.status === "completed")).toHaveLength(1);
    expect(fulfilled.filter((r) => r.status === "already_completed")).toHaveLength(19);
    expect(await db.query.questCompletion.findMany({ where: eq(questCompletion.playerQuestId, quest.id) })).toHaveLength(1);
    expect(await db.query.xpLedger.findMany({ where: eq(xpLedger.sourceId, quest.id) })).toHaveLength(1);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("enforces the custom category limit under parallel completions", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < 8; i++) {
      await createCustomQuest(
        db,
        userId,
        { title: `Task ${i}`, description: "", category: "career", difficulty: "normal", attribute: null, xpReward: null, scheduleType: "once", targetDate: null, days: [], estimatedMinutes: null, checklist: [] },
        NOON,
      );
    }
    const quests = await listOpenOneOffQuests(db, userId);
    const results = await Promise.all(quests.map((q) => completeQuest(db, userId, q.id, { now: NOON })));
    // The quest rows lock independently, so the category count must stay exact via the progress lock.
    const rewarded = results.filter((r) => r.xp.granted > 0);
    expect(rewarded).toHaveLength(3);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("grants a weekly reward once when parallel completions reach the target together", async () => {
    const userId = await newPlayer(["fitness", "learning"]);
    await ensureWeeklyChallenges(db, userId, NOON);
    // The default challenge needs 5 quests of any kind; complete 5 custom ones at once.
    for (let i = 0; i < 5; i++) {
      await createCustomQuest(
        db,
        userId,
        { title: `Mixed ${i}`, description: "", category: (["career", "finance", "social", "wellbeing", "organization"] as const)[i], difficulty: "easy", attribute: null, xpReward: null, scheduleType: "once", targetDate: null, days: [], estimatedMinutes: null, checklist: [] },
        NOON,
      );
    }
    const quests = await listOpenOneOffQuests(db, userId);
    await Promise.all(quests.map((q) => completeQuest(db, userId, q.id, { now: NOON })));
    const challenge = (await db.query.weeklyChallenge.findMany({ where: eq(weeklyChallenge.userId, userId) })).find(
      (w) => w.countsAnyCategory,
    )!;
    expect(challenge).toMatchObject({ progress: 5, status: "completed" });
    const weeklyRewards = (await db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) })).filter(
      (l) => l.eventType === "weekly_completed",
    );
    expect(weeklyRewards).toHaveLength(1);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("checks a habit in once when 15 check-ins race", async () => {
    const { checkInHabit, createHabit } = await import("@/server/services/habits");
    const userId = await newPlayer();
    const h = await createHabit(db, userId, { name: "Water", description: "", category: "wellbeing", attribute: null, scheduleType: "days", days: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: null, linkedTemplateId: null }, NOON);
    const results = await Promise.all(Array.from({ length: 15 }, () => checkInHabit(db, userId, h.id, NOON)));
    expect(results.filter((r) => r.status === "checked_in")).toHaveLength(1);
    const ledger = (await db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) })).filter((l) => l.eventType === "habit_completed");
    expect(ledger).toHaveLength(1);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("does not deadlock or double-pay when a linked check-in and its quest completion race", async () => {
    const { checkInHabit, createHabit, listLinkableTemplates } = await import("@/server/services/habits");
    for (let round = 0; round < 5; round++) {
      const userId = await newPlayer(["learning"]);
      const study = (await listLinkableTemplates(db, userId)).find((t) => t.category === "learning")!;
      const h = await createHabit(db, userId, { name: "Study", description: "", category: "learning", attribute: null, scheduleType: "days", days: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: null, linkedTemplateId: study.id }, NOON);
      const quest = (await listQuestsForDay(db, userId, "2026-10-27")).find((q) => q.templateId === study.id)!;
      await Promise.all([
        checkInHabit(db, userId, h.id, NOON),
        completeQuest(db, userId, quest.id, { now: NOON }),
        checkInHabit(db, userId, h.id, NOON),
        completeQuest(db, userId, quest.id, { now: NOON }),
      ]);
      const ledger = await db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) });
      expect(ledger.map((l) => l.eventType)).toEqual(["quest_completed"]);
      const { habitCompletion } = await import("@/db/schema");
      expect(await db.query.habitCompletion.findMany({ where: eq(habitCompletion.habitId, h.id) })).toHaveLength(1);
      expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
    }
  });
});
