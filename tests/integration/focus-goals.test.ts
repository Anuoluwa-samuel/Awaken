import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { focusSession, playerProgress, playerSkill, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { GOAL_RULES } from "@/lib/progression/config";
import { checkProgressConsistency } from "@/server/services/consistency";
import {
  completeFocus,
  endFocusEarly,
  getActiveFocus,
  getFocusSummary,
  pauseFocus,
  resumeFocus,
  startFocus,
} from "@/server/services/focus";
import {
  addMilestone,
  archiveGoal,
  completeMilestone,
  createGoal,
  createQuestForMilestone,
  listGoals,
} from "@/server/services/goals";
import { createPlayer } from "@/server/services/player";
import { completeQuest, createCustomQuest, ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

// Lagos = UTC+1, day starts 04:00. 2026-10-27 is a Tuesday.
const T0 = new Date("2026-10-27T10:00:00Z");
const after = (seconds: number, from = T0) => new Date(from.getTime() + seconds * 1000);

async function newPlayer(focusAreas: ("learning" | "career")[] = []) {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    { displayName: "P", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas, preferredDifficulty: "normal", dailyTarget: null },
    T0,
  );
  return userId;
}
const ledger = (userId: string) => db.query.xpLedger.findMany({ where: eq(xpLedger.userId, userId) });

describe("focus sessions", () => {
  it("credits a full session once, excluding paused time", async () => {
    const userId = await newPlayer();
    const { session } = await startFocus(db, userId, { minutes: 25 }, T0);
    await pauseFocus(db, userId, session.id, after(600));
    await resumeFocus(db, userId, session.id, after(900)); // 5 minutes paused
    // 25 min after start is only 20 focused minutes.
    await expect(completeFocus(db, userId, session.id, after(1500))).rejects.toMatchObject({ code: "NOT_FINISHED" });
    const done = await completeFocus(db, userId, session.id, after(1800));
    expect(done).toMatchObject({ status: "completed", via: "focus", xp: { granted: 10 } });
    expect(await completeFocus(db, userId, session.id, after(1900))).toMatchObject({ status: "already_ended" });

    const focusXp = (await ledger(userId)).filter((l) => l.eventType === "focus_completed");
    expect(focusXp).toHaveLength(1);
    const row = await db.query.focusSession.findFirst({ where: eq(focusSession.id, session.id) });
    expect(row).toMatchObject({ status: "completed", creditedSeconds: 1500, totalPausedSeconds: 300 });
  });

  it("recovers the active session and refuses a second one", async () => {
    const userId = await newPlayer();
    const first = await startFocus(db, userId, { minutes: 15 }, T0);
    const second = await startFocus(db, userId, { minutes: 45 }, after(30));
    expect(second).toMatchObject({ resumedExisting: true, session: { id: first.session.id, plannedSeconds: 900 } });
    expect((await getActiveFocus(db, userId))?.session.id).toBe(first.session.id);
  });

  it("records early endings without XP", async () => {
    const userId = await newPlayer();
    const { session } = await startFocus(db, userId, { minutes: 25 }, T0);
    const ended = await endFocusEarly(db, userId, session.id, after(600));
    expect(ended).toMatchObject({ status: "abandoned", creditedSeconds: 600 });
    await expect(completeFocus(db, userId, session.id, after(5000))).resolves.toMatchObject({ status: "already_ended" });
    expect(await ledger(userId)).toHaveLength(0);
    const summary = await getFocusSummary(db, userId, "2026-10-27");
    expect(summary).toMatchObject({ todaySeconds: 600, completedToday: 0 });
  });

  it("validates durations server-side, with Deep Focus extending them", async () => {
    const userId = await newPlayer();
    await expect(startFocus(db, userId, { minutes: 5 }, T0)).rejects.toMatchObject({ code: "INVALID_DURATION" });
    await expect(startFocus(db, userId, { minutes: 90 }, T0)).rejects.toMatchObject({ code: "INVALID_DURATION" });
    await db.insert(playerSkill).values({ userId, skillCode: "deep-focus" });
    await expect(startFocus(db, userId, { minutes: 90 }, T0)).resolves.toMatchObject({ session: { plannedSeconds: 5400 } });
  });

  it("hides other players' sessions", async () => {
    const owner = await newPlayer();
    const other = await newPlayer();
    const { session } = await startFocus(db, owner, { minutes: 25 }, T0);
    await expect(pauseFocus(db, other, session.id, after(10))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(completeFocus(db, other, session.id, after(2000))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getActiveFocus(db, other)).toBeNull();
  });

  it("completes a linked quest instead of paying focus XP when it covers the estimate", async () => {
    const userId = await newPlayer(["learning"]);
    const study = (await listQuestsForDay(db, userId, "2026-10-27")).find((q) => q.title.startsWith("Read or study"))!;
    expect(study.estimatedMinutes).toBe(30);

    // 25 minutes doesn't cover a 30-minute quest → focus XP, quest stays open.
    const short = await startFocus(db, userId, { minutes: 25, questId: study.id }, T0);
    const r1 = await completeFocus(db, userId, short.session.id, after(1500));
    expect(r1).toMatchObject({ via: "focus", xp: { granted: 10 }, linkedQuestNote: expect.stringMatching(/30 minutes/) });

    const long = await startFocus(db, userId, { minutes: 30, questId: study.id }, after(1600));
    const r2 = await completeFocus(db, userId, long.session.id, after(1600 + 1800));
    expect(r2).toMatchObject({ via: "quest", xp: { granted: 25 } });
    const events = (await ledger(userId)).map((l) => l.eventType).sort();
    expect(events.filter((e) => e === "focus_completed")).toHaveLength(1); // only the first session
    expect(events.filter((e) => e === "quest_completed")).toHaveLength(1);
    const completion = await db.query.questCompletion.findFirst({ where: (c, { eq }) => eq(c.playerQuestId, study.id) });
    expect(completion?.method).toBe("focus_session");
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });
});

describe("goals", () => {
  const goalInput = (milestones: string[]) => ({
    title: "Ship my portfolio",
    description: "",
    category: "career" as const,
    deadline: null,
    milestones,
  });

  it("tracks progress from milestones and rewards completion once, on a later day", async () => {
    const userId = await newPlayer();
    const g = await createGoal(db, userId, goalInput(["Design", "Build", "Deploy"]), T0);
    let [item] = await listGoals(db, userId, "2026-10-27");
    expect(item.progress).toMatchObject({ done: 0, total: 3 });

    const day2 = new Date("2026-10-28T10:00:00Z");
    await completeMilestone(db, userId, item.milestones[0].id, day2);
    await completeMilestone(db, userId, item.milestones[1].id, day2);
    expect(await completeMilestone(db, userId, item.milestones[1].id, day2)).toMatchObject({ status: "already_completed" });
    const last = await completeMilestone(db, userId, item.milestones[2].id, day2);
    expect(last.goalCompleted).toMatchObject({ title: g.title, xp: { granted: 30 } });
    expect(last.goalCompleted?.achievements.map((a) => a.code)).toContain("finisher");

    [item] = await listGoals(db, userId, "2026-10-28");
    expect(item.goal.status).toBe("completed");
    expect((await ledger(userId)).filter((l) => l.eventType === "goal_completed")).toHaveLength(1);
    await expect(completeMilestone(db, userId, item.milestones[0].id, day2)).resolves.toMatchObject({ status: "already_completed" });
  });

  it("explains why some goals earn no XP", async () => {
    const userId = await newPlayer();
    // One milestone → no reward; finished the same day → no reward.
    await createGoal(db, userId, goalInput(["Only step"]), T0);
    await createGoal(db, userId, goalInput(["A", "B"]), T0);
    const goals = await listGoals(db, userId, "2026-10-27");
    for (const item of goals) for (const m of item.milestones) await completeMilestone(db, userId, m.id, T0);
    const done = await listGoals(db, userId, "2026-10-27");
    expect(done.every((g) => g.goal.status === "completed")).toBe(true);
    expect((await ledger(userId)).filter((l) => l.eventType === "goal_completed")).toHaveLength(0);
    expect(goals[0].rewardPreview).toMatchObject({ eligible: false });
  });

  it("caps rewarded goals per day", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < GOAL_RULES.maxRewardedPerDay + 1; i++) await createGoal(db, userId, goalInput(["A", "B"]), T0);
    const day2 = new Date("2026-10-28T10:00:00Z");
    const results = [];
    for (const item of await listGoals(db, userId, "2026-10-28")) {
      await completeMilestone(db, userId, item.milestones[0].id, day2);
      results.push((await completeMilestone(db, userId, item.milestones[1].id, day2)).goalCompleted);
    }
    expect(results.map((r) => r?.xp.granted)).toEqual([20, 20, 0]);
    expect(results[2]?.xp.note).toMatch(/per day/);
  });

  it("links milestones to quests: completing either completes both, rewarded once", async () => {
    const userId = await newPlayer();
    await createGoal(db, userId, goalInput(["Write the case study", "Record a demo"]), T0);
    const [item] = await listGoals(db, userId, "2026-10-27");
    const { questId } = await createQuestForMilestone(db, userId, item.milestones[0].id, T0);
    await expect(createQuestForMilestone(db, userId, item.milestones[0].id, T0)).rejects.toMatchObject({ code: "INVALID_STATE" });

    // Completing the quest marks the milestone.
    await completeQuest(db, userId, questId, { now: T0 });
    let [now] = await listGoals(db, userId, "2026-10-27");
    expect(now.milestones[0].completedAt).not.toBeNull();

    // Completing the second milestone via its own quest from the milestone side.
    const second = await createQuestForMilestone(db, userId, now.milestones[1].id, T0);
    const r = await completeMilestone(db, userId, now.milestones[1].id, T0);
    expect(r.quest?.status).toBe("completed");
    const quest2 = await db.query.playerQuest.findFirst({ where: (q, { eq }) => eq(q.id, second.questId) });
    expect(quest2?.status).toBe("completed");
    [now] = await listGoals(db, userId, "2026-10-27");
    expect(now.goal.status).toBe("completed");
    expect((await ledger(userId)).filter((l) => l.eventType === "quest_completed")).toHaveLength(2);
    expect((await checkProgressConsistency(db, userId)).ok).toBe(true);
  });

  it("isolates players and respects archive", async () => {
    const owner = await newPlayer();
    const other = await newPlayer();
    const g = await createGoal(db, owner, goalInput(["A", "B"]), T0);
    const [item] = await listGoals(db, owner, "2026-10-27");
    await expect(completeMilestone(db, other, item.milestones[0].id, T0)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(addMilestone(db, other, g.id, "Sneaky")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(archiveGoal(db, other, g.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await archiveGoal(db, owner, g.id);
    expect(await listGoals(db, owner, "2026-10-27")).toHaveLength(0);
  });

  it("unrelated custom quests don't touch goals", async () => {
    const userId = await newPlayer();
    await createGoal(db, userId, goalInput(["A", "B"]), T0);
    const c = await createCustomQuest(
      db,
      userId,
      { title: "Unrelated", description: "", category: "career", difficulty: "easy", attribute: null, xpReward: null, scheduleType: "once", targetDate: null, days: [], estimatedMinutes: null, checklist: [] },
      T0,
    );
    await ensureDailyQuests(db, userId, T0);
    await completeQuest(db, userId, c.kind === "once" ? c.questId : "", { now: T0 });
    const [item] = await listGoals(db, userId, "2026-10-27");
    expect(item.progress.done).toBe(0);
    const p = await db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
    expect(p?.totalXp).toBeGreaterThan(0);
  });
});
