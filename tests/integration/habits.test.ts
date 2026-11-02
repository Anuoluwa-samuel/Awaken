import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { habitCompletion, playerProgress, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { HABIT_RULES } from "@/lib/progression/config";
import type { HabitInput } from "@/lib/validation/habit";
import { checkProgressConsistency } from "@/server/services/consistency";
import {
  archiveHabit,
  checkInHabit,
  createHabit,
  HabitError,
  listHabits,
  listLinkableTemplates,
} from "@/server/services/habits";
import { createPlayer } from "@/server/services/player";
import { completeQuest, ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { grantXp } from "@/server/services/rewards";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

// Lagos = UTC+1, day starts 04:00 local. 2026-10-27 is a Tuesday.
const at = (date: string, hourUtc = 11) => new Date(`${date}T${String(hourUtc).padStart(2, "0")}:00:00Z`);
const TUE = at("2026-10-27");

async function newPlayer() {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    { displayName: "P", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas: ["learning", "fitness"], preferredDifficulty: "normal", dailyTarget: null },
    TUE,
  );
  return userId;
}

const input = (over: Partial<HabitInput> = {}): HabitInput => ({
  name: "Drink water",
  description: "",
  category: "wellbeing",
  attribute: null,
  scheduleType: "days",
  days: [0, 1, 2, 3, 4, 5, 6],
  timesPerWeek: null,
  linkedTemplateId: null,
  ...over,
});

const progressOf = async (userId: string) =>
  (await db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) }))!;

describe("habit check-ins", () => {
  it("rewards a scheduled check-in once per day", async () => {
    const userId = await newPlayer();
    const h = await createHabit(db, userId, input(), TUE);
    expect(h).toMatchObject({ attribute: "vitality", startDate: "2026-10-27", timesPerWeek: null });

    const first = await checkInHabit(db, userId, h.id, TUE);
    expect(first).toMatchObject({ status: "checked_in", via: "habit", counted: true, xp: { granted: HABIT_RULES.xp } });
    expect(await checkInHabit(db, userId, h.id, TUE)).toMatchObject({ status: "already_checked_in" });
    expect((await progressOf(userId)).totalXp).toBe(HABIT_RULES.xp);

    // Next day, new check-in.
    await checkInHabit(db, userId, h.id, at("2026-10-28"));
    expect((await progressOf(userId)).totalXp).toBe(HABIT_RULES.xp * 2);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("uses the player's day boundary", async () => {
    const userId = await newPlayer();
    const h = await createHabit(db, userId, input(), TUE);
    await checkInHabit(db, userId, h.id, at("2026-10-27"));
    // 02:30 UTC on the 28th is 03:30 in Lagos — still the 27th's quest day.
    expect(await checkInHabit(db, userId, h.id, new Date("2026-10-28T02:30:00Z"))).toMatchObject({
      status: "already_checked_in",
      date: "2026-10-27",
    });
  });

  it("records rest-day check-ins without a reward", async () => {
    const userId = await newPlayer();
    const h = await createHabit(db, userId, input({ days: [1, 3, 5] }), TUE); // Mon/Wed/Fri
    const r = await checkInHabit(db, userId, h.id, TUE);
    expect(r).toMatchObject({ status: "checked_in", counted: false, xp: { granted: 0 } });
    expect((await progressOf(userId)).totalXp).toBe(0);
    const ledger = await db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) });
    expect(ledger).toHaveLength(0);
  });

  it("rewards weekly habits only up to the target", async () => {
    const userId = await newPlayer();
    const h = await createHabit(db, userId, input({ scheduleType: "weekly", days: [], timesPerWeek: 2 }), TUE);
    const results = [];
    for (const d of ["2026-10-27", "2026-10-28", "2026-10-29"]) results.push(await checkInHabit(db, userId, h.id, at(d)));
    expect(results.map((r) => r.status === "checked_in" && r.counted)).toEqual([true, true, false]);
    // New week resets the count.
    expect(await checkInHabit(db, userId, h.id, at("2026-11-02"))).toMatchObject({ counted: true });
  });

  it("still rewards habits after a big day: there's no daily XP limit", async () => {
    const userId = await newPlayer();
    await db.transaction((tx) =>
      grantXp(tx, { userId, eventType: "quest_completed", sourceType: "test", amount: 5000, reason: "fill", idempotencyKey: `${userId}:fill`, now: TUE }),
    );
    const h = await createHabit(db, userId, input(), TUE);
    const r = await checkInHabit(db, userId, h.id, TUE);
    expect(r).toMatchObject({ counted: true, xp: { granted: HABIT_RULES.xp, note: null } });
  });

  it("isolates players and rejects archived habits", async () => {
    const owner = await newPlayer();
    const other = await newPlayer();
    const h = await createHabit(db, owner, input(), TUE);
    await expect(checkInHabit(db, other, h.id, TUE)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(archiveHabit(db, other, h.id, TUE)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await archiveHabit(db, owner, h.id, TUE);
    await expect(checkInHabit(db, owner, h.id, TUE)).rejects.toBeInstanceOf(HabitError);
    expect(await listHabits(db, owner, "2026-10-27")).toHaveLength(0);
  });

  it("limits active habits", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < HABIT_RULES.maxActiveHabits; i++) await createHabit(db, userId, input({ name: `H${i}` }), TUE);
    await expect(createHabit(db, userId, input(), TUE)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });
});

describe("habits linked to quests", () => {
  async function linkedSetup() {
    const userId = await newPlayer();
    const study = (await listLinkableTemplates(db, userId)).find((t) => t.category === "learning")!;
    const h = await createHabit(db, userId, input({ name: "Study", category: "learning", linkedTemplateId: study.id }), TUE);
    const quest = (await listQuestsForDay(db, userId, "2026-10-27")).find((q) => q.templateId === study.id)!;
    return { userId, h, quest };
  }

  it("checking in completes the quest and grants only the quest's rewards", async () => {
    const { userId, h, quest } = await linkedSetup();
    const r = await checkInHabit(db, userId, h.id, TUE);
    expect(r).toMatchObject({ status: "checked_in", via: "quest", xp: { granted: 25 } });
    // Quest reward once, plus the First Blood achievement — never a habit reward.
    const ledger = await db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) });
    expect(ledger.map((l) => l.eventType).sort()).toEqual(["achievement_unlocked", "quest_completed"]);
    expect(r.status === "checked_in" && r.achievements.map((a) => a.code)).toEqual(["first-blood"]);
    const completion = await db.query.questCompletion.findFirst({ where: (c, { eq }) => eq(c.playerQuestId, quest.id) });
    expect(completion?.method).toBe("habit");
    // Completing the quest again or checking in again changes nothing.
    expect((await completeQuest(db, userId, quest.id, { now: TUE })).status).toBe("already_completed");
    expect(await checkInHabit(db, userId, h.id, TUE)).toMatchObject({ status: "already_checked_in" });
    expect((await progressOf(userId)).totalXp).toBe(25 + 10);
  });

  it("completing the quest directly records the habit check-in without extra XP", async () => {
    const { userId, h, quest } = await linkedSetup();
    await completeQuest(db, userId, quest.id, { now: TUE });
    const checkIns = await db.query.habitCompletion.findMany({ where: eq(habitCompletion.habitId, h.id) });
    expect(checkIns.map((c) => c.localDate)).toEqual(["2026-10-27"]);
    expect(await checkInHabit(db, userId, h.id, TUE)).toMatchObject({ status: "already_checked_in" });
    expect((await progressOf(userId)).totalXp).toBe(25 + 10); // quest + First Blood
    const ledger = await db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) });
    expect(ledger.some((l) => l.eventType === "habit_completed")).toBe(false);
  });

  it("falls back to the habit reward when there is no open linked quest today", async () => {
    const { userId, h, quest } = await linkedSetup();
    const { cancelQuest } = await import("@/server/services/quests");
    await cancelQuest(db, userId, quest.id);
    expect(await checkInHabit(db, userId, h.id, TUE)).toMatchObject({ via: "habit", xp: { granted: HABIT_RULES.xp } });
  });

  it("only links to the player's own scheduled daily quests", async () => {
    const userId = await newPlayer();
    const other = await newPlayer();
    const othersTemplate = (await listLinkableTemplates(db, other))[0];
    // System templates are shared, so build a private one for the other player.
    const { createCustomQuest } = await import("@/server/services/quests");
    const created = await createCustomQuest(
      db,
      other,
      { title: "Secret", description: "", category: "career", difficulty: "easy", attribute: null, xpReward: null, scheduleType: "recurring", targetDate: null, days: [2], estimatedMinutes: null, checklist: [] },
      TUE,
    );
    expect(othersTemplate).toBeDefined();
    await expect(
      createHabit(db, userId, input({ linkedTemplateId: created.kind === "recurring" ? created.templateId : "" }), TUE),
    ).rejects.toMatchObject({ code: "INVALID_LINK" });
  });
});

describe("listHabits", () => {
  it("returns stats and a calendar from persisted check-ins", async () => {
    const userId = await newPlayer();
    const h = await createHabit(db, userId, input({ days: [1, 2, 3, 4, 5] }), TUE);
    for (const d of ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]) {
      await ensureDailyQuests(db, userId, at(d));
      await checkInHabit(db, userId, h.id, at(d));
    }
    // Saturday 31st and Sunday 1st are rest days; Monday 2nd not yet checked in.
    const [item] = await listHabits(db, userId, "2026-11-02");
    expect(item.stats).toMatchObject({ current: 4, longest: 4, doneToday: false, scheduledToday: true });
    const week = item.calendar.at(-2)!;
    expect(week.map((c) => c.state)).toEqual(["before", "done", "done", "done", "done", "rest", "rest"]);
    const rows = await db.query.habitCompletion.findMany({ where: and(eq(habitCompletion.userId, userId)) });
    expect(rows).toHaveLength(4);
  });
});
