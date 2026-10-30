import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notification, playerProfile, playerProgress, playerQuestSchedule, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { xpToReach } from "@/lib/progression/levels";
import {
  equipTitle,
  evaluateAchievements,
  listAchievements,
  listTitles,
} from "@/server/services/achievements";
import { checkProgressConsistency } from "@/server/services/consistency";
import { checkInHabit, createHabit } from "@/server/services/habits";
import { createPlayer } from "@/server/services/player";
import { completeQuest, ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { grantXp } from "@/server/services/rewards";
import { listSkillTree, unlockSkill } from "@/server/services/skills";
import { ensureWeeklyChallenges, listWeeklyChallenges } from "@/server/services/weekly";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const at = (date: string) => new Date(`${date}T11:00:00Z`);
const TUE = at("2026-10-27");

async function newPlayer() {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    { displayName: "P", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas: ["learning"], preferredDifficulty: "normal", dailyTarget: null },
    TUE,
  );
  return userId;
}

/** Jump a player to a level with an (uncapped) adjustment-free grant. */
async function boostTo(userId: string, level: number) {
  await db.transaction((tx) =>
    grantXp(tx, { userId, eventType: "goal_completed", sourceType: "test", amount: xpToReach(level), reason: "boost", idempotencyKey: `boost:${userId}:${level}`, now: TUE }),
  );
}

const ledgerFor = (userId: string) => db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) });

describe("achievement engine", () => {
  it("unlocks First Blood once with its XP and a single notification", async () => {
    const userId = await newPlayer();
    const [quest] = await listQuestsForDay(db, userId, "2026-10-27");
    const r = await completeQuest(db, userId, quest.id, { now: TUE });
    expect(r.achievements).toEqual([expect.objectContaining({ code: "first-blood", xpReward: 10 })]);

    // Re-evaluating any number of times changes nothing.
    for (let i = 0; i < 3; i++) expect(await db.transaction((tx) => evaluateAchievements(tx, userId, TUE))).toEqual([]);
    const achievementXp = (await ledgerFor(userId)).filter((l) => l.eventType === "achievement_unlocked");
    expect(achievementXp).toHaveLength(1);
    const notes = await db.query.notification.findMany({
      where: and(eq(notification.userId, userId), eq(notification.type, "achievement")),
    });
    expect(notes).toHaveLength(1);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("grants titles and chains unlocks caused by achievement XP", async () => {
    const userId = await newPlayer();
    await boostTo(userId, 5);
    const unlocked = await db.transaction((tx) => evaluateAchievements(tx, userId, TUE));
    expect(unlocked.map((u) => u.code)).toContain("awakening");
    expect((await listTitles(db, userId)).map((t) => t.title)).toEqual(["The Awakened"]);
  });

  it("does not unlock what the records don't support", async () => {
    const userId = await newPlayer();
    expect(await db.transaction((tx) => evaluateAchievements(tx, userId, TUE))).toEqual([]);
    const list = await listAchievements(db, userId, "2026-10-27");
    expect(list.every((a) => a.unlockedAt === null)).toBe(true);
    expect(list.find((a) => a.code === "scholar")?.progress).toEqual({ current: 0, target: 25, ratio: 0 });
  });

  it("unlocks habit achievements from persisted check-ins", async () => {
    const userId = await newPlayer();
    const h = await createHabit(
      db,
      userId,
      { name: "Water", description: "", category: "wellbeing", attribute: null, scheduleType: "days", days: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: null, linkedTemplateId: null },
      TUE,
    );
    let routine = null;
    for (let i = 0; i < 10; i++) {
      const d = new Date(TUE.getTime() + i * 86_400_000);
      await ensureDailyQuests(db, userId, d);
      const r = await checkInHabit(db, userId, h.id, d);
      if (r.status === "checked_in" && r.achievements.some((a) => a.code === "routine")) routine = i + 1;
    }
    expect(routine).toBe(10);
  });
});

describe("titles", () => {
  it("equips only earned titles and changes no progression", async () => {
    const userId = await newPlayer();
    await expect(equipTitle(db, userId, "Shadow Monarch")).rejects.toMatchObject({ code: "TITLE_NOT_OWNED" });
    await boostTo(userId, 5);
    await db.transaction((tx) => evaluateAchievements(tx, userId, TUE));
    const before = await db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
    const ledgerBefore = (await ledgerFor(userId)).length;

    await equipTitle(db, userId, "The Awakened");
    await equipTitle(db, userId, "The Awakened");
    expect((await db.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId) }))?.equippedTitle).toBe("The Awakened");
    await equipTitle(db, userId, null);
    expect((await db.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId) }))?.equippedTitle).toBeNull();

    expect(await db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) })).toEqual(before);
    expect((await ledgerFor(userId)).length).toBe(ledgerBefore);
  });
});

describe("skill tree", () => {
  it("enforces level, prerequisites, points and availability", async () => {
    const userId = await newPlayer();
    await expect(unlockSkill(db, userId, "early-bird", TUE)).rejects.toMatchObject({ code: "level" });
    await boostTo(userId, 5); // 4 skill points
    await expect(unlockSkill(db, userId, "consistency", TUE)).rejects.toMatchObject({ code: "prerequisite" });
    await expect(unlockSkill(db, userId, "deep-focus", TUE)).rejects.toMatchObject({ code: "unavailable" });
    await expect(unlockSkill(db, userId, "nope", TUE)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const r = await unlockSkill(db, userId, "early-bird", TUE);
    expect(r.achievements.map((a) => a.code)).toContain("skilled");
    await expect(unlockSkill(db, userId, "early-bird", TUE)).rejects.toMatchObject({ code: "unlocked" });
    await unlockSkill(db, userId, "consistency", TUE);

    const tree = await listSkillTree(db, userId);
    expect(tree.pointsAvailable).toBe(2);
    expect(tree.skills.find((s) => s.code === "quick-learner")?.blockerMessage).toBe("Requires level 8.");
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("refuses when points run out and never overspends", async () => {
    const userId = await newPlayer();
    await boostTo(userId, 10); // level 10 → 9 points earned
    await db.update(playerProgress).set({ skillPointsSpent: 8 }).where(eq(playerProgress.userId, userId)); // 1 left
    await unlockSkill(db, userId, "early-bird", TUE);
    await expect(unlockSkill(db, userId, "consistency", TUE)).rejects.toMatchObject({ code: "points" });
    const tree = await listSkillTree(db, userId);
    expect(tree.pointsAvailable).toBe(0);
    expect(tree.skills.find((s) => s.code === "consistency")?.blockerMessage).toBe("Needs 1 skill point; you have 0.");
  });

  it("Early Bird schedules the morning quest from today", async () => {
    const userId = await newPlayer();
    await boostTo(userId, 3);
    const before = await listQuestsForDay(db, userId, "2026-10-27");
    expect(before.some((q) => q.title === "Complete your morning routine")).toBe(false);
    await unlockSkill(db, userId, "early-bird", TUE);
    const after = await listQuestsForDay(db, userId, "2026-10-27");
    expect(after.filter((q) => q.title === "Complete your morning routine")).toHaveLength(1);
  });

  it("gated templates never appear without the skill, even if scheduled", async () => {
    const userId = await newPlayer();
    const morning = await db.query.questTemplate.findFirst({ where: (t, { eq }) => eq(t.key, "daily.morning-routine") });
    await db.insert(playerQuestSchedule).values({ userId, templateId: morning!.id });
    await ensureDailyQuests(db, userId, at("2026-10-28"));
    const quests = await listQuestsForDay(db, userId, "2026-10-28");
    expect(quests.some((q) => q.templateId === morning!.id)).toBe(false);
  });

  it("Quick Learner adds the advanced weekly challenge", async () => {
    const userId = await newPlayer();
    await boostTo(userId, 8);
    await unlockSkill(db, userId, "early-bird", TUE);
    await unlockSkill(db, userId, "quick-learner", TUE);
    await ensureWeeklyChallenges(db, userId, TUE);
    const weekly = await listWeeklyChallenges(db, userId, "2026-10-26");
    expect(weekly.find((w) => w.title === "Advanced study block")).toMatchObject({ target: 6, xpReward: 200 });
  });

  it("keeps players' skills isolated", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await boostTo(a, 3);
    await unlockSkill(db, a, "early-bird", TUE);
    const tree = await listSkillTree(db, b);
    expect(tree.skills.find((s) => s.code === "early-bird")?.unlockedAt).toBeNull();
  });
});
