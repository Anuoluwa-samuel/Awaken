import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/db/types";
import { getShellSummary, getStatusWindow } from "@/server/services/dashboard";
import { createPlayer } from "@/server/services/player";
import { completeQuest, createCustomQuest, ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const clock = (today: string) => ({ today, timeZone: "Africa/Lagos", dayStartHour: 4 });

describe("dashboard", () => {
  it("counts only scheduled quests as daily, but includes open custom quests in the open total", async () => {
    const userId = await createUser(db);
    const now = new Date("2026-10-27T11:00:00Z");
    await createPlayer(db, userId, { displayName: "P", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas: [], preferredDifficulty: "normal", dailyTarget: null }, now);
    await createCustomQuest(db, userId, { title: "Side quest", description: "", category: "career", difficulty: "easy", attribute: null, xpReward: null, scheduleType: "once", targetDate: null, days: [], estimatedMinutes: null, checklist: [] }, now);
    const summary = await getShellSummary(db, userId, "2026-10-27");
    expect(summary).toMatchObject({ questsTotal: 3, questsDone: 0, questsOpen: 4 });
    const status = await getStatusWindow(db, userId, clock("2026-10-27"));
    expect(status.todayQuests).toHaveLength(3);
  });

  it("computes the streak from when completions happened in the player's zone", async () => {
    const userId = await createUser(db);
    await createPlayer(db, userId, { displayName: "P", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas: [], preferredDifficulty: "normal", dailyTarget: null }, new Date("2026-10-25T11:00:00Z"));
    // 25th midday, 26th midday, and 03:30 local on the 28th (= still the 27th's quest day).
    const times = ["2026-10-25T11:00:00Z", "2026-10-26T11:00:00Z", "2026-10-28T02:30:00Z"];
    for (const t of times) {
      const now = new Date(t);
      const day = await ensureDailyQuests(db, userId, now);
      const [q] = await listQuestsForDay(db, userId, day);
      await completeQuest(db, userId, q.id, { now });
    }
    expect((await getStatusWindow(db, userId, clock("2026-10-27"))).streak).toBe(3);
    // On the 28th the streak survives (today isn't over). On the 29th this week's freeze covers the
    // missed 28th; on the 30th two days are missed, which no freeze covers.
    expect((await getStatusWindow(db, userId, clock("2026-10-28"))).streak).toBe(3);
    expect(await getStatusWindow(db, userId, clock("2026-10-29"))).toMatchObject({ streak: 3, freezeAvailable: false });
    expect((await getStatusWindow(db, userId, clock("2026-10-30"))).streak).toBe(0);
  });
});

describe("activity and history", () => {
  it("merges XP grants with level events, newest first, level event above its grant", async () => {
    const { getRecentActivity, getProgressionHistory } = await import("@/server/services/dashboard");
    const { grantXp } = await import("@/server/services/rewards");
    const userId = await createUser(db);
    const now = new Date("2026-10-27T11:00:00Z");
    await createPlayer(db, userId, { displayName: "P", timeZone: "UTC", dayStartHour: 4, focusAreas: [], preferredDifficulty: "normal", dailyTarget: null }, now);
    const grant = (key: string, amount: number, at: Date) =>
      db.transaction((tx) =>
        grantXp(tx, { userId, eventType: "achievement_unlocked", sourceType: "test", amount, reason: key, idempotencyKey: `${userId}:${key}`, now: at }),
      );
    await grant("small", 50, new Date("2026-10-27T11:00:00Z"));
    await grant("big", 1600, new Date("2026-10-27T12:00:00Z")); // → level 10, D-Rank

    const feed = await getRecentActivity(db, userId, 10);
    expect(feed.map((i) => (i.kind === "level" ? `level ${i.toLevel}` : i.reason))).toEqual(["level 10", "big", "small"]);

    // Same-instant grants: the follow-on (weekly) reward and its level-up sit above the quest.
    const t = new Date("2026-10-27T13:00:00Z");
    await db.transaction(async (tx) => {
      await grantXp(tx, { userId, eventType: "quest_completed", sourceType: "player_quest", amount: 10, reason: "quest", idempotencyKey: `${userId}:q`, now: t });
      await grantXp(tx, { userId, eventType: "weekly_completed", sourceType: "weekly_challenge", amount: 400, reason: "weekly", idempotencyKey: `${userId}:w`, now: t });
    });
    const tied = await getRecentActivity(db, userId, 3);
    expect(tied.map((i) => (i.kind === "level" ? `level ${i.toLevel}` : i.reason))).toEqual(["level 11", "weekly", "quest"]);

    const history = await getProgressionHistory(db, userId);
    expect(history.rankUps).toHaveLength(1);
    expect(history.rankUps[0]).toMatchObject({ fromRank: "E", toRank: "D" });
    expect(history.ledgerXp).toBe(2060);

    const summary = await getShellSummary(db, userId, "2026-10-27");
    expect(summary.skillPoints).toBe(10);
  });
});
