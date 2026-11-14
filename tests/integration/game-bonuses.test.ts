import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { notification, playerAchievement, playerProfile, pushSubscription, questTemplate, weeklyChallenge, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { comboBonus, isEventDay, verifiedBonus } from "@/lib/progression/bonuses";
import { addDays } from "@/lib/time";
import {
  addFriendByCode,
  answerFriendRequest,
  answerQuestVerification,
  cheerLevelUp,
  getFriendsPage,
  getVerificationOptions,
  requestQuestVerification,
} from "@/server/services/friends";
import { getBootSummary } from "@/server/services/boot";
import { createPlayer } from "@/server/services/player";
import { savePushSubscription, sendEveningReminders } from "@/server/services/push";
import { createPoolQuest, listQuestPool, MIN_ACTIVE_POOL, setPoolQuestActive, updatePoolQuest } from "@/server/services/quest-pool";
import { cancelQuest, completeQuest, ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { getWeeklyReport } from "@/server/services/report";
import { grantXp } from "@/server/services/rewards";
import { ensureWeeklyChallenges } from "@/server/services/weekly";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());
afterEach(() => {
  process.env.SYSTEM_EVENTS = "off";
});

// Mon 2026-11-09. Lagos is UTC+1; quest days start at 04:00 local.
const MON = "2026-11-09";
const noon = (date: string) => new Date(`${date}T11:00:00Z`);
const clockFor = (today: string) => ({ today, timeZone: "Africa/Lagos", dayStartHour: 4 });

async function newPlayer(name = "Player", focusAreas: ("learning" | "fitness")[] = ["learning", "fitness"]) {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    { displayName: name, timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas, preferredDifficulty: "normal", dailyTarget: null },
    noon(MON),
  );
  return userId;
}
const questsOn = async (userId: string, date: string) => {
  await ensureDailyQuests(db, userId, noon(date));
  return listQuestsForDay(db, userId, date);
};
const codeOf = async (userId: string) =>
  (await db.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId) }))!.friendCode;
const owns = async (userId: string, code: string) =>
  !!(await db.query.playerAchievement.findFirst({
    where: and(eq(playerAchievement.userId, userId), eq(playerAchievement.achievementCode, code)),
  }));

describe("daily combo", () => {
  it("pays once when the last daily quest of the day is completed", async () => {
    const userId = await newPlayer();
    const quests = await questsOn(userId, MON);
    expect(quests.length).toBeGreaterThanOrEqual(2);
    let last;
    for (const q of quests) last = await completeQuest(db, userId, q.id, { now: noon(MON) });
    const expected = comboBonus(quests.reduce((sum, q) => sum + q.xpReward, 0));
    expect(last!.combo).toEqual({ xp: expected });
    expect(last!.achievements.map((a) => a.code)).toContain("clean-sweep");

    const combos = await db.query.xpLedger.findMany({
      where: and(eq(xpLedger.userId, userId), eq(xpLedger.sourceType, "daily_combo")),
    });
    expect(combos.map((c) => [c.eventType, c.amount])).toEqual([["bonus", expected]]);
  });

  it("isn't paid when a quest was skipped", async () => {
    const userId = await newPlayer();
    const [skip, ...rest] = await questsOn(userId, MON);
    await cancelQuest(db, userId, skip!.id);
    let last;
    for (const q of rest) last = await completeQuest(db, userId, q.id, { now: noon(MON) });
    expect(last!.combo).toBeNull();
  });
});

describe("System events", () => {
  it("adds one fresh double-XP quest on event days and announces it", async () => {
    process.env.SYSTEM_EVENTS = "on";
    const userId = await newPlayer();
    await questsOn(userId, MON); // day one: the starter set, never an event
    let day = addDays(MON, 1);
    while (!isEventDay(userId, day)) day = addDays(day, 1);
    // Visit the day before, so "not yesterday's quest" is tested too.
    const before = await questsOn(userId, addDays(day, -1));
    const quests = await questsOn(userId, day);
    const events = quests.filter((q) => q.isEvent);
    expect(events).toHaveLength(1);
    const template = await db.query.questTemplate.findFirst({ where: eq(questTemplate.id, events[0]!.templateId!) });
    expect(events[0]!.xpReward).toBe(2 * (template!.xpReward ?? { easy: 10, normal: 25, hard: 50, elite: 100 }[template!.difficulty]));
    expect(before.map((q) => q.templateId)).not.toContain(events[0]!.templateId);
    expect(quests.filter((q) => !q.isEvent).map((q) => q.templateId)).not.toContain(events[0]!.templateId);
    const note = await db.query.notification.findFirst({ where: eq(notification.dedupeKey, `event:${userId}:${day}`) });
    expect(note?.title).toBe("System event");

    // Not needed for the combo, and unlocks the hidden achievement.
    const done = await completeQuest(db, userId, events[0]!.id, { now: noon(day) });
    expect(done.combo).toBeNull();
    expect(done.achievements.map((a) => a.code)).toContain("answer-the-call");
  });

  it("stays off with SYSTEM_EVENTS=off", async () => {
    const userId = await newPlayer();
    for (let i = 1; i < 15; i++) expect((await questsOn(userId, addDays(MON, i))).some((q) => q.isEvent)).toBe(false);
  });
});

describe("weekly boss", () => {
  it("is one per week, survives focus changes, and its defeat is announced", async () => {
    const userId = await newPlayer("Boss", ["fitness"]);
    await ensureWeeklyChallenges(db, userId, noon(MON));
    await db.update(playerProfile).set({ focusAreas: ["learning", "career"] }).where(eq(playerProfile.userId, userId));
    await ensureWeeklyChallenges(db, userId, noon(MON));
    const bosses = await db.query.weeklyChallenge.findMany({
      where: and(eq(weeklyChallenge.userId, userId), eq(weeklyChallenge.isBoss, true)),
    });
    expect(bosses).toHaveLength(1);
    expect(["Boss: The Gauntlet", "Boss: Iron Body"]).toContain(bosses[0]!.title);

    // Defeat it by completing one-off custom quests in its category.
    const boss = bosses[0]!;
    await db.update(weeklyChallenge).set({ progress: boss.target - 1 }).where(eq(weeklyChallenge.id, boss.id));
    const [q] = (await questsOn(userId, MON)).filter((x) => boss.countsAnyCategory || x.category === boss.category);
    const r = await completeQuest(db, userId, q!.id, { now: noon(MON) });
    expect(r.weekly.find((w) => w.isBoss)).toMatchObject({ completed: true, xpGranted: boss.xpReward });
    expect(r.achievements.map((a) => a.code)).toContain("boss-slayer");
    const note = await db.query.notification.findFirst({ where: eq(notification.dedupeKey, `weekly:${boss.id}`) });
    expect(note?.title).toBe("Boss defeated");
  });
});

describe("friends", () => {
  it("connects by code once accepted, and two requests meet in the middle", async () => {
    const [a, b, c] = [await newPlayer("Ada"), await newPlayer("Bo"), await newPlayer("Cy")];
    await expect(addFriendByCode(db, a, await codeOf(a))).rejects.toMatchObject({ code: "SELF" });
    await expect(addFriendByCode(db, a, "NOPE2345")).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Loose typing is fine.
    const code = await codeOf(b);
    expect(await addFriendByCode(db, a, `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`)).toMatchObject({ status: "requested" });
    await expect(addFriendByCode(db, a, code)).rejects.toMatchObject({ code: "ALREADY" });
    const pageB = await getFriendsPage(db, b);
    expect(pageB.incoming.map((r) => r.person.displayName)).toEqual(["Ada"]);
    expect(pageB.friends).toEqual([]);
    await answerFriendRequest(db, b, pageB.incoming[0]!.id, true);
    expect((await getFriendsPage(db, a)).friends.map((f) => f.person.displayName)).toEqual(["Bo"]);
    expect(await owns(a, "party-of-two")).toBe(true);

    // C asks A while A asks C: the second becomes an acceptance.
    await addFriendByCode(db, c, await codeOf(a));
    expect(await addFriendByCode(db, a, await codeOf(c))).toMatchObject({ status: "accepted", name: "Cy" });

    // Friends never see an email.
    expect(JSON.stringify(await getFriendsPage(db, a))).not.toContain("@example.test");
  });

  it("cheers a friend's level-up once; strangers can't", async () => {
    const [a, b, stranger] = [await newPlayer("Ada"), await newPlayer("Bo"), await newPlayer("Stranger")];
    await addFriendByCode(db, a, await codeOf(b));
    await addFriendByCode(db, b, await codeOf(a));
    await db.transaction((tx) =>
      grantXp(tx, { userId: b, eventType: "bonus", sourceType: "test", amount: 500, reason: "test", idempotencyKey: `${b}:lvl` }),
    );
    const [levelUp] = (await getFriendsPage(db, a)).levelUps;
    expect(levelUp).toMatchObject({ name: "Bo", cheered: false, cheers: 0 });
    expect(await cheerLevelUp(db, a, levelUp!.id)).toEqual({ status: "cheered" });
    expect(await cheerLevelUp(db, a, levelUp!.id)).toEqual({ status: "already" });
    expect((await getFriendsPage(db, a)).levelUps[0]).toMatchObject({ cheered: true, cheers: 1 });
    await expect(cheerLevelUp(db, stranger, levelUp!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const notes = await db.query.notification.findMany({ where: and(eq(notification.userId, b), eq(notification.title, "⚡ Cheer")) });
    expect(notes.map((n) => n.body)).toEqual([expect.stringMatching(/^Ada cheered your level \d+\.$/)]);
  });

  it("a friend's confirmation adds a bonus once; a decline adds nothing", async () => {
    const [a, b, stranger] = [await newPlayer("Ada"), await newPlayer("Bo"), await newPlayer("Stranger")];
    await addFriendByCode(db, a, await codeOf(b));
    await addFriendByCode(db, b, await codeOf(a));
    const [q1, q2, open] = await questsOn(a, MON);
    await completeQuest(db, a, q1!.id, { now: noon(MON) });
    await completeQuest(db, a, q2!.id, { now: noon(MON) });

    await expect(requestQuestVerification(db, a, open!.id, b, noon(MON))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(requestQuestVerification(db, a, q1!.id, stranger, noon(MON))).rejects.toMatchObject({ code: "NOT_FRIENDS" });
    await expect(requestQuestVerification(db, a, q1!.id, b, noon(addDays(MON, 3)))).rejects.toMatchObject({ code: "INVALID" });
    await requestQuestVerification(db, a, q1!.id, b, noon(MON));
    await expect(requestQuestVerification(db, a, q1!.id, b, noon(MON))).rejects.toMatchObject({ code: "ALREADY" });
    await requestQuestVerification(db, a, q2!.id, b, noon(MON));

    const [first, second] = (await getFriendsPage(db, b)).verifications.sort((x, y) => x.questTitle.localeCompare(y.questTitle));
    const byTitle = new Map([
      [q1!.title, q1!],
      [q2!.title, q2!],
    ]);
    const confirmed = await answerQuestVerification(db, b, first!.id, true);
    expect(confirmed.xp).toBe(verifiedBonus(byTitle.get(first!.questTitle)!.xpReward));
    await expect(answerQuestVerification(db, b, first!.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await answerQuestVerification(db, b, second!.id, false)).toEqual({ status: "declined", xp: 0 });
    // Only the verifier can answer.
    expect((await getFriendsPage(db, b)).verifications).toEqual([]);

    const bonuses = await db.query.xpLedger.findMany({
      where: and(eq(xpLedger.userId, a), eq(xpLedger.sourceType, "quest_verification")),
    });
    expect(bonuses).toHaveLength(1);
  });
});

describe("weekly report", () => {
  it("sums last week by the player's days and suggests the weakest area", async () => {
    const userId = await newPlayer();
    const quests = await questsOn(userId, MON);
    await completeQuest(db, userId, quests[0]!.id, { now: noon(MON) });
    const r = await getWeeklyReport(db, userId, clockFor(addDays(MON, 7)), MON);
    expect(r.days).toHaveLength(7);
    expect(r.questsCompleted).toBe(1);
    expect(r.bestDay?.date).toBe(MON);
    expect(r.totalXp).toBe(r.days.reduce((s, d) => s + d.xp, 0));
    expect(r.totalXp).toBeGreaterThanOrEqual(quests[0]!.xpReward);
    expect(r.strongest?.points).toBeGreaterThan(0);
    expect(r.suggestion.attribute).not.toBe(r.strongest?.attribute);
  });
});

describe("evening reminders", () => {
  it("reminds subscribed players at 7 PM their time, once a day, and drops dead subscriptions", async () => {
    const userId = await newPlayer();
    await questsOn(userId, MON);
    await savePushSubscription(db, userId, { endpoint: `https://push.example.test/${userId}/1`, keys: { p256dh: "k", auth: "a" } });
    await savePushSubscription(db, userId, { endpoint: `https://push.example.test/${userId}/gone`, keys: { p256dh: "k", auth: "a" } });
    const sent: string[] = [];
    const send = async (sub: { endpoint: string }, payload: { title: string }) => {
      sent.push(`${sub.endpoint.split("/").pop()}:${payload.title}`);
      return !sub.endpoint.endsWith("gone");
    };
    // 17:00 UTC is 18:00 in Lagos: too early.
    await sendEveningReminders(db, send, new Date(`${MON}T17:00:00Z`));
    expect(sent).toEqual([]);
    const at7 = new Date(`${MON}T18:00:00Z`);
    const result = await sendEveningReminders(db, send, at7);
    expect(result).toMatchObject({ removed: 1 });
    expect(sent.sort()).toEqual(["1:Almost there", "gone:Almost there"]);
    // A second run in the same hour sends nothing.
    await sendEveningReminders(db, send, at7);
    expect(sent).toHaveLength(2);
    expect(await db.query.pushSubscription.findMany({ where: eq(pushSubscription.userId, userId) })).toHaveLength(1);
  });
});

describe("quest pool editor", () => {
  it("adds and edits its own quests, never seeded ones, and keeps enough active", async () => {
    const admin = await createUser(db);
    const id = await createPoolQuest(db, admin, {
      title: "Write a thank-you note",
      description: "To anyone.",
      category: "social",
      difficulty: "easy",
      estimatedMinutes: 10,
    });
    await updatePoolQuest(db, admin, id, {
      title: "Write a thank-you message",
      description: "To anyone.",
      category: "social",
      difficulty: "easy",
      estimatedMinutes: 5,
    });
    const pool = await listQuestPool(db);
    expect(pool.find((q) => q.id === id)).toMatchObject({ title: "Write a thank-you message", editable: true, isActive: true });

    const seeded = pool.find((q) => !q.editable)!;
    await expect(
      updatePoolQuest(db, admin, seeded.id, { title: "Hacked", description: "", category: "social", difficulty: "easy", estimatedMinutes: null }),
    ).rejects.toMatchObject({ code: "SEEDED" });

    // Retire until the floor, then refuse.
    const active = pool.filter((q) => q.isActive);
    for (const q of active.slice(0, active.length - MIN_ACTIVE_POOL)) await setPoolQuestActive(db, admin, q.id, false);
    const last = (await listQuestPool(db)).find((q) => q.isActive)!;
    await expect(setPoolQuestActive(db, admin, last.id, false)).rejects.toMatchObject({ code: "TOO_FEW" });
    // Retired quests stop being handed out.
    const retired = new Set((await listQuestPool(db)).filter((q) => !q.isActive).map((q) => q.id));
    const userId = await newPlayer();
    for (let i = 1; i < 6; i++) {
      for (const q of await questsOn(userId, addDays(MON, i))) expect(retired.has(q.templateId!)).toBe(false);
    }
    for (const q of retired) await setPoolQuestActive(db, admin, q, true);
  });
});

describe("daily boot screen", () => {
  it("reports yesterday's XP and today's quests, and stays quiet on the first day", async () => {
    const userId = await newPlayer("Booter");
    await db.update(playerProfile).set({ createdAt: noon(MON) }).where(eq(playerProfile.userId, userId));
    const [quest] = await questsOn(userId, MON);
    await completeQuest(db, userId, quest!.id, { now: noon(MON) });

    expect((await getBootSummary(db, userId, clockFor(MON))).firstDay).toBe(true);
    const tue = addDays(MON, 1);
    await questsOn(userId, tue);
    const boot = await getBootSummary(db, userId, clockFor(tue));
    expect(boot).toMatchObject({ today: tue, firstDay: false, questsToday: 5 });
    expect(boot.yesterdayXp).toBeGreaterThanOrEqual(quest!.xpReward);
  });
});

describe("confirmation options on a quest", () => {
  it("offers friends only inside the window and before anyone was asked", async () => {
    const [a, b] = [await newPlayer("Asker"), await newPlayer("Friend")];
    const [quest] = await questsOn(a, MON);
    await completeQuest(db, a, quest!.id, { now: noon(MON) });
    const completedAt = noon(MON);
    expect((await getVerificationOptions(db, a, quest!.id, completedAt, noon(MON))).canAsk).toBe(false); // no friends yet
    await addFriendByCode(db, a, await codeOf(b));
    await addFriendByCode(db, b, await codeOf(a));
    const open = await getVerificationOptions(db, a, quest!.id, completedAt, noon(MON));
    expect(open).toMatchObject({ canAsk: true, verification: null, friends: [{ userId: b, name: "Friend" }] });
    expect((await getVerificationOptions(db, a, quest!.id, completedAt, noon(addDays(MON, 3)))).canAsk).toBe(false);
    await requestQuestVerification(db, a, quest!.id, b, noon(MON));
    const asked = await getVerificationOptions(db, a, quest!.id, completedAt, noon(MON));
    expect(asked).toMatchObject({ canAsk: false, verification: { status: "pending", verifierName: "Friend" } });
  });
});
