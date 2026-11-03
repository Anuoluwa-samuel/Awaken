import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  notification,
  playerAttribute,
  playerProgress,
  playerQuest,
  questCompletion,
  weeklyChallenge,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { LIMITS, QUEST_LIMITS, type Category } from "@/lib/progression/config";
import { checkProgressConsistency } from "@/server/services/consistency";
import { createPlayer } from "@/server/services/player";
import {
  cancelQuest,
  completeQuest,
  createCustomQuest,
  ensureDailyQuests,
  getQuestDetail,
  listOpenOneOffQuests,
  listQuestsForDay,
  QuestError,
  startQuest,
} from "@/server/services/quests";
import { ensureWeeklyChallenges, listWeeklyChallenges } from "@/server/services/weekly";
import type { CustomQuestInput } from "@/lib/validation/quest";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

// Lagos = UTC+1; day starts 04:00 local = 03:00 UTC. 2026-10-27 is a Tuesday.
const NOON = new Date("2026-10-27T11:00:00Z");
const TODAY = "2026-10-27";

async function newPlayer(focusAreas: Category[] = ["learning", "fitness"]) {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    { displayName: "P", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas, preferredDifficulty: "normal", dailyTarget: null },
    NOON,
  );
  return userId;
}

const dailyQuests = async (userId: string, date = TODAY) =>
  (await listQuestsForDay(db, userId, date)).filter((q) => q.kind === "daily");
const progressOf = (userId: string) =>
  db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });

const custom = (over: Partial<CustomQuestInput> = {}): CustomQuestInput => ({
  title: "Ship the landing page",
  description: "",
  category: "career",
  difficulty: "normal",
  attribute: null,
  xpReward: null,
  scheduleType: "once",
  targetDate: null,
  days: [],
  estimatedMinutes: null,
  checklist: [],
  ...over,
});

describe("completeQuest", () => {
  it("completes a daily quest and grants XP, attributes and the discipline bonus", async () => {
    const userId = await newPlayer();
    const q = (await dailyQuests(userId)).find((x) => x.category === "learning")!;
    const r = await completeQuest(db, userId, q.id, { evidenceNote: "Read 2 chapters", now: NOON });

    expect(r).toMatchObject({ status: "completed", xp: { requested: 25, granted: 25, note: null } });
    expect(r.attributes).toEqual([
      { attribute: "intelligence", granted: 2 },
      { attribute: "discipline", granted: LIMITS.dailyQuestDisciplineBonus },
    ]);
    const detail = await getQuestDetail(db, userId, q.id);
    expect(detail?.quest.status).toBe("completed");
    expect(detail?.completion).toMatchObject({ method: "self_reported", evidenceNote: "Read 2 chapters" });
    expect(detail?.xp).toHaveLength(1);
  });

  it("is idempotent: repeats return already_completed and grant nothing", async () => {
    const userId = await newPlayer();
    const q = (await dailyQuests(userId))[0];
    await completeQuest(db, userId, q.id, { now: NOON });
    const again = await completeQuest(db, userId, q.id, { now: NOON });
    expect(again).toMatchObject({ status: "already_completed", xp: { granted: 0 } });
    expect(await db.query.questCompletion.findMany({ where: eq(questCompletion.playerQuestId, q.id) })).toHaveLength(1);
    expect(await db.query.xpLedger.findMany({ where: eq(xpLedger.sourceId, q.id) })).toHaveLength(1);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("reports level-ups in the result", async () => {
    // review 10 + workout 25 + study 25 + skill 50 + writing 25 = 135 XP.
    const userId = await newPlayer(["learning", "fitness", "career", "creativity"]);
    const quests = await dailyQuests(userId);
    let levelUp = null;
    for (const q of quests) levelUp ??= (await completeQuest(db, userId, q.id, { now: NOON })).levelChange;
    expect((await progressOf(userId))!.totalXp).toBeGreaterThanOrEqual(100);
    expect(levelUp).toMatchObject({ fromLevel: 1, toLevel: 2 });
  });

  it("hides other players' quests (no IDOR)", async () => {
    const owner = await newPlayer();
    const attacker = await newPlayer();
    const q = (await dailyQuests(owner))[0];
    await expect(completeQuest(db, attacker, q.id, { now: NOON })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(startQuest(db, attacker, q.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(cancelQuest(db, attacker, q.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getQuestDetail(db, attacker, q.id)).toBeNull();
    expect((await progressOf(attacker))!.totalXp).toBe(0);
    expect((await getQuestDetail(db, owner, q.id))!.quest.status).toBe("available");
  });

  it("rejects cancelled and expired quests", async () => {
    const userId = await newPlayer();
    const [a, b] = await dailyQuests(userId);
    await cancelQuest(db, userId, a.id);
    await expect(completeQuest(db, userId, a.id, { now: NOON })).rejects.toMatchObject({ code: "INVALID_STATE" });

    await ensureDailyQuests(db, userId, new Date("2026-10-28T11:00:00Z"));
    await expect(
      completeQuest(db, userId, b.id, { now: new Date("2026-10-28T11:00:00Z") }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("rejects yesterday's quest even if rollover has not run yet", async () => {
    const userId = await newPlayer();
    const q = (await dailyQuests(userId))[0];
    await expect(
      completeQuest(db, userId, q.id, { now: new Date("2026-10-28T03:00:00Z") }),
    ).rejects.toMatchObject({ code: "NOT_TODAY" });
    // …but 03:59 local is still the same quest day.
    expect(
      (await completeQuest(db, userId, q.id, { now: new Date("2026-10-28T02:59:00Z") })).status,
    ).toBe("completed");
  });

  it("start → complete works and start is idempotent", async () => {
    const userId = await newPlayer();
    const q = (await dailyQuests(userId))[0];
    expect((await startQuest(db, userId, q.id, NOON)).status).toBe("in_progress");
    expect((await startQuest(db, userId, q.id, NOON)).status).toBe("in_progress");
    expect((await completeQuest(db, userId, q.id, { now: NOON })).status).toBe("completed");
    await expect(startQuest(db, userId, q.id)).rejects.toBeInstanceOf(QuestError);
  });
});

describe("custom quests", () => {
  it("snapshots a clamped reward and derives the attribute from the category", async () => {
    const userId = await newPlayer();
    const created = await createCustomQuest(db, userId, custom({ difficulty: "easy", xpReward: 9999 }), NOON);
    expect(created).toMatchObject({ kind: "once", xpReward: 20 });
    const [q] = await listOpenOneOffQuests(db, userId);
    expect(q).toMatchObject({ kind: "custom", xpReward: 20, attribute: "intelligence", dueAt: null });
  });

  it("expires one-off quests after their target date", async () => {
    const userId = await newPlayer();
    await createCustomQuest(db, userId, custom({ targetDate: "2026-10-28" }), NOON);
    const [q] = await listOpenOneOffQuests(db, userId);
    expect(q.dueAt?.toISOString()).toBe("2026-10-29T03:00:00.000Z");
    await ensureDailyQuests(db, userId, new Date("2026-10-29T03:00:00Z"));
    expect(await listOpenOneOffQuests(db, userId)).toHaveLength(0);
    await expect(
      completeQuest(db, userId, q.id, { now: new Date("2026-10-29T04:00:00Z") }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("rejects a target date in the past", async () => {
    const userId = await newPlayer();
    await expect(createCustomQuest(db, userId, custom({ targetDate: "2026-10-26" }), NOON)).rejects.toMatchObject({
      code: "PAST_DUE",
    });
  });

  it("caps rewarded custom completions per category per day", async () => {
    const userId = await newPlayer([]);
    for (let i = 0; i < 4; i++) await createCustomQuest(db, userId, custom({ title: `Task ${i}` }), NOON);
    const quests = await listOpenOneOffQuests(db, userId);
    const results = [];
    for (const q of quests) results.push(await completeQuest(db, userId, q.id, { now: NOON }));
    expect(results.map((r) => r.xp.granted)).toEqual([25, 25, 25, 0]);
    expect(results[3].xp.note).toMatch(/limited to 3/);
    expect(results[3].attributes).toEqual([]);

    // A different category is unaffected.
    await createCustomQuest(db, userId, custom({ title: "Sketch", category: "creativity" }), NOON);
    const [sketch] = (await listOpenOneOffQuests(db, userId)).filter((q) => q.category === "creativity");
    expect((await completeQuest(db, userId, sketch.id, { now: NOON })).xp.granted).toBe(25);
  });

  it("limits the number of open custom quests", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < QUEST_LIMITS.maxOpenCustomQuests; i++) {
      await createCustomQuest(db, userId, custom({ title: `Quest ${i}` }), NOON);
    }
    await expect(createCustomQuest(db, userId, custom(), NOON)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("recurring quests appear only on scheduled days and reward once per day", async () => {
    const userId = await newPlayer([]);
    // Tuesday (2) and Thursday (4).
    await createCustomQuest(db, userId, custom({ title: "Guitar", category: "creativity", scheduleType: "recurring", days: [2, 4] }), NOON);
    const tue = (await listQuestsForDay(db, userId, TODAY)).filter((q) => q.title === "Guitar");
    expect(tue).toHaveLength(1);
    expect(tue[0].kind).toBe("custom");
    expect((await completeQuest(db, userId, tue[0].id, { now: NOON })).xp.granted).toBe(25);
    expect((await completeQuest(db, userId, tue[0].id, { now: NOON })).status).toBe("already_completed");

    await ensureDailyQuests(db, userId, new Date("2026-10-28T11:00:00Z")); // Wednesday
    expect((await listQuestsForDay(db, userId, "2026-10-28")).filter((q) => q.title === "Guitar")).toHaveLength(0);
    await ensureDailyQuests(db, userId, new Date("2026-10-29T11:00:00Z")); // Thursday
    expect((await listQuestsForDay(db, userId, "2026-10-29")).filter((q) => q.title === "Guitar")).toHaveLength(1);
  });

  it("limits recurring custom quests", async () => {
    const userId = await newPlayer([]);
    for (let i = 0; i < QUEST_LIMITS.maxRecurringCustomQuests; i++) {
      await createCustomQuest(db, userId, custom({ title: `R${i}`, scheduleType: "recurring", days: [1] }), NOON);
    }
    await expect(
      createCustomQuest(db, userId, custom({ scheduleType: "recurring", days: [1] }), NOON),
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });
});

describe("weekly challenges", () => {
  it("assigns challenges from focus areas plus the default, once per week", async () => {
    const userId = await newPlayer(["fitness"]);
    await ensureWeeklyChallenges(db, userId, NOON);
    await ensureWeeklyChallenges(db, userId, NOON);
    const weekly = await listWeeklyChallenges(db, userId, "2026-10-26");
    expect(weekly.map((w) => w.title).sort()).toEqual(["Complete five planned tasks", "Finish three workouts"]);
    expect(weekly.find((w) => w.title === "Finish three workouts")).toMatchObject({ target: 3, xpReward: 100 });
  });

  it("advances from matching completions and rewards exactly once", async () => {
    const userId = await newPlayer(["fitness"]);
    // Three workouts on three days (Tue, Wed, Thu).
    for (const day of ["2026-10-27", "2026-10-28", "2026-10-29"]) {
      const now = new Date(`${day}T11:00:00Z`);
      await ensureDailyQuests(db, userId, now);
      const workout = (await dailyQuests(userId, day)).find((q) => q.category === "fitness" && q.difficulty !== "hard")!;
      await completeQuest(db, userId, workout.id, { now });
    }
    const [workouts] = (await listWeeklyChallenges(db, userId, "2026-10-26")).filter((w) => w.category === "fitness");
    expect(workouts).toMatchObject({ progress: 3, status: "completed" });
    expect(workouts.rewardClaimedAt).not.toBeNull();

    const ledger = await db.query.xpLedger.findMany({
      where: and(eq(xpLedger.userId, userId), eq(xpLedger.eventType, "weekly_completed")),
    });
    expect(ledger.map((l) => l.amount)).toEqual([100]);
    const notes = await db.query.notification.findMany({
      where: and(eq(notification.userId, userId), eq(notification.type, "weekly")),
    });
    expect(notes).toHaveLength(1);

    // A fourth workout doesn't re-award.
    const fri = new Date("2026-10-30T11:00:00Z");
    await ensureDailyQuests(db, userId, fri);
    const w4 = (await dailyQuests(userId, "2026-10-30")).find((q) => q.category === "fitness")!;
    const r = await completeQuest(db, userId, w4.id, { now: fri });
    expect(r.weekly.find((w) => w.challengeId === workouts.id)).toBeUndefined();
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("reports a level-up caused by the weekly reward, not just the quest XP", async () => {
    const userId = await newPlayer(["fitness"]);
    // A recurring quest, so the numbers don't depend on the day's rotating mix.
    await createCustomQuest(
      db,
      userId,
      custom({ title: "Daily workout", category: "fitness", scheduleType: "recurring", days: [0, 1, 2, 3, 4, 5, 6] }),
      new Date("2026-10-27T10:00:00Z"),
    );
    let last = null;
    // 3 workouts = 75 XP + First Blood 10 (still level 1); the third also completes the
    // weekly (+100) and unlocks Consistent (+25) → 210 XP.
    for (const day of ["2026-10-27", "2026-10-28", "2026-10-29"]) {
      const now = new Date(`${day}T11:00:00Z`);
      await ensureDailyQuests(db, userId, now);
      const workout = (await listQuestsForDay(db, userId, day)).find((q) => q.title === "Daily workout")!;
      last = await completeQuest(db, userId, workout.id, { now });
    }
    expect(last!.xp.granted).toBe(25);
    expect(last!.levelChange).toMatchObject({ fromXp: 60, toXp: 210, fromLevel: 1, toLevel: 2 });
    expect(last!.achievements.map((a) => a.code)).toEqual(["consistent"]);
    expect(last!.player.level.level).toBe(2);
  });

  it("counts any category for the default challenge and ignores non-matching ones", async () => {
    const userId = await newPlayer(["fitness", "learning"]);
    const learning = (await dailyQuests(userId)).find((q) => q.category === "learning")!;
    const r = await completeQuest(db, userId, learning.id, { now: NOON });
    expect(r.weekly.map((w) => w.title).sort()).toEqual(["Complete five planned tasks", "Complete four study sessions"]);
    const workouts = (await db.query.weeklyChallenge.findMany({ where: eq(weeklyChallenge.userId, userId) })).find(
      (w) => w.category === "fitness",
    );
    expect(workouts?.progress).toBe(0);
  });

  it("expires last week's unfinished challenges and opens new ones", async () => {
    const userId = await newPlayer(["fitness"]);
    const nextMonday = new Date("2026-11-02T11:00:00Z");
    expect(await ensureWeeklyChallenges(db, userId, nextMonday)).toBe("2026-11-02");
    const old = await listWeeklyChallenges(db, userId, "2026-10-26");
    expect(old.every((w) => w.status === "expired")).toBe(true);
    expect((await listWeeklyChallenges(db, userId, "2026-11-02")).every((w) => w.status === "active")).toBe(true);
  });
});

describe("attribute totals", () => {
  it("match the ledger after a mixed session", async () => {
    const userId = await newPlayer(["learning", "fitness", "creativity"]);
    for (const q of await dailyQuests(userId)) await completeQuest(db, userId, q.id, { now: NOON });
    const attrs = await db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) });
    expect(attrs.find((a) => a.attribute === "discipline")!.points).toBeGreaterThan(0);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
    // Every completion has exactly one quest_completion row.
    const done = await db.query.playerQuest.findMany({
      where: and(eq(playerQuest.userId, userId), eq(playerQuest.status, "completed")),
    });
    const completions = await db.query.questCompletion.findMany({ where: eq(questCompletion.userId, userId) });
    expect(completions).toHaveLength(done.length);
  });
});
