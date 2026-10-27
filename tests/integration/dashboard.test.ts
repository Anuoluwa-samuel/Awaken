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
    // On the 28th the streak survives (today isn't over); on the 29th it is broken.
    expect((await getStatusWindow(db, userId, clock("2026-10-28"))).streak).toBe(3);
    expect((await getStatusWindow(db, userId, clock("2026-10-29"))).streak).toBe(0);
  });
});
