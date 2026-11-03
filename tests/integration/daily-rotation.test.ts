import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { playerQuest, playerQuestSchedule, playerSkill, questTemplate } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { addDays } from "@/lib/time";
import { createHabit, listLinkableTemplates } from "@/server/services/habits";
import { createPlayer, updateSettings } from "@/server/services/player";
import { cancelQuest, createCustomQuest, ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const DAY_ONE = "2026-11-02";
const noon = (date: string) => new Date(`${date}T11:00:00Z`);
const settings = {
  displayName: "Rotator",
  timeZone: "Africa/Lagos",
  dayStartHour: 4,
  focusAreas: ["learning", "fitness"] as ("learning" | "fitness")[],
  preferredDifficulty: "normal" as const,
  dailyTarget: null,
};

async function newPlayer(overrides: Partial<typeof settings> | { dailyTarget: number } = {}) {
  const userId = await createUser(db);
  await createPlayer(db, userId, { ...settings, ...overrides }, noon(DAY_ONE));
  return userId;
}
const onDay = async (userId: string, date: string) => {
  await ensureDailyQuests(db, userId, noon(date));
  return listQuestsForDay(db, userId, date);
};
const titles = (quests: { title: string }[]) => quests.map((q) => q.title).sort();

describe("daily quest rotation", () => {
  it("gives a different mix each day, with no quest two days running", async () => {
    const userId = await newPlayer();
    const days = [];
    for (let i = 0; i < 14; i++) days.push(await onDay(userId, addDays(DAY_ONE, i)));
    for (let i = 1; i < days.length; i++) {
      const yesterday = new Set(titles(days[i - 1]!));
      expect(titles(days[i]!).filter((title) => yesterday.has(title)), `day ${i}`).toEqual([]);
    }
    expect(new Set(days.flat().map((q) => q.title)).size).toBeGreaterThan(20);
  });

  it("stays the same within a day, however often it's loaded", async () => {
    const userId = await newPlayer();
    const date = addDays(DAY_ONE, 1);
    const first = titles(await onDay(userId, date));
    await Promise.all(Array.from({ length: 5 }, () => ensureDailyQuests(db, userId, noon(date))));
    expect(titles(await onDay(userId, date))).toEqual(first);
  });

  it("gives different players different quests on the same day", async () => {
    const date = addDays(DAY_ONE, 1);
    const [a, b, c] = await Promise.all([newPlayer(), newPlayer(), newPlayer()]);
    const mixes = await Promise.all([a!, b!, c!].map(async (id) => titles(await onDay(id, date)).join()));
    expect(new Set(mixes).size).toBeGreaterThan(1);
  });

  it("doesn't refill the day when a quest is skipped", async () => {
    const userId = await newPlayer();
    const date = addDays(DAY_ONE, 1);
    const [quest] = await onDay(userId, date);
    await cancelQuest(db, userId, quest!.id);
    const after = await onDay(userId, date);
    expect(after.filter((q) => q.status !== "cancelled")).toHaveLength(4);
  });

  it("applies a changed target and focus areas from the next day, not today", async () => {
    const userId = await newPlayer();
    const today = addDays(DAY_ONE, 1);
    const tomorrow = addDays(DAY_ONE, 2);
    expect(await onDay(userId, today)).toHaveLength(5);
    await updateSettings(db, userId, { ...settings, dailyTarget: 8, focusAreas: ["fitness"] }, noon(today));
    expect(await onDay(userId, today)).toHaveLength(5);
    const next = await onDay(userId, tomorrow);
    expect(next).toHaveLength(8);
    expect(next.filter((q) => q.category === "fitness").length).toBeGreaterThanOrEqual(4);
  });

  it("keeps quests the player chose: recurring, skill rewards, and habit links", async () => {
    const userId = await newPlayer();
    const [linkable] = await listLinkableTemplates(db, userId);
    await createHabit(db, userId, {
      name: "Linked habit",
      description: "",
      category: linkable!.category,
      attribute: null,
      scheduleType: "days",
      days: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: null,
      linkedTemplateId: linkable!.id,
    }, noon(DAY_ONE));
    await createCustomQuest(db, userId, {
      title: "My own daily",
      description: "",
      category: "creativity",
      difficulty: "normal",
      attribute: null,
      xpReward: null,
      scheduleType: "recurring",
      targetDate: null,
      days: [0, 1, 2, 3, 4, 5, 6],
      estimatedMinutes: null,
      checklist: [],
    }, noon(DAY_ONE));
    const reward = await db.query.questTemplate.findFirst({ where: eq(questTemplate.key, "daily.morning-routine") });
    await db.insert(playerSkill).values({ userId, skillCode: "early-bird" });
    await db.insert(playerQuestSchedule).values({ userId, templateId: reward!.id });

    for (let i = 1; i <= 4; i++) {
      const quests = await onDay(userId, addDays(DAY_ONE, i));
      const all = titles(quests);
      expect(all).toContain("My own daily");
      expect(all).toContain(reward!.title);
      expect(all).toContain(linkable!.title);
      // On top of the rotating set, with no duplicates.
      expect(quests.length).toBe(8);
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it("still works on a pool that hasn't had the new quests added yet", async () => {
    const userId = await newPlayer();
    const old = new Set(["daily.review-priorities", "daily.workout", "daily.stretch", "daily.study-30", "daily.skill-45"]);
    const system = await db.select().from(questTemplate).where(and(isNull(questTemplate.ownerUserId), eq(questTemplate.cadence, "daily")));
    const hidden = system.filter((t) => !old.has(t.key ?? ""));
    for (const t of hidden) await db.update(questTemplate).set({ isActive: false }).where(eq(questTemplate.id, t.id));
    try {
      const quests = await onDay(userId, addDays(DAY_ONE, 1));
      expect(quests.length).toBeGreaterThan(0);
      expect(new Set(titles(quests)).size).toBe(quests.length);
    } finally {
      for (const t of hidden) await db.update(questTemplate).set({ isActive: t.isActive }).where(eq(questTemplate.id, t.id));
    }
  });

  it("never touches days already played", async () => {
    const userId = await newPlayer();
    const before = titles(await onDay(userId, DAY_ONE));
    await onDay(userId, addDays(DAY_ONE, 1));
    const past = await db.query.playerQuest.findMany({ where: and(eq(playerQuest.userId, userId), eq(playerQuest.questDate, DAY_ONE)) });
    expect(titles(past)).toEqual(before);
  });
});
