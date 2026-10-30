import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { goal, goalMilestone, playerProfile, playerQuest } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { GOAL_RULES } from "@/lib/progression/config";
import { goalProgress, goalRewardCheck } from "@/lib/progression/goals";
import { questDay, type QuestDate } from "@/lib/time";
import type { GoalInput } from "@/lib/validation/goal";
import { completeGoalIfDone, type GoalCompletion } from "./goal-links";
import { completeQuest, createCustomQuest, type CompletionResult } from "./quests";
import { lockProgress } from "./rewards";

// Goals & milestones — docs/ARCHITECTURE.md §6e.
// Progress is completed milestones ÷ milestones, nothing else. A milestone linked to a quest
// completes when that quest does (and completing the milestone completes the quest), so the
// quest's reward is the only one for that step. When the last milestone completes, the goal
// completes and may earn a capped, rate-limited reward.

export class GoalError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "INVALID_STATE" | "LIMIT_REACHED" | "PLAYER_NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

async function playerToday(tx: AppDb, userId: string, now: Date) {
  const profile = await tx.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { timeZone: true, dayStartHour: true },
  });
  if (!profile) throw new GoalError("PLAYER_NOT_FOUND", "Player profile not found");
  return questDay(now, profile.timeZone, profile.dayStartHour);
}

async function lockOwnedGoal(tx: AppDb, userId: string, goalId: string) {
  const [g] = await tx
    .select()
    .from(goal)
    .where(and(eq(goal.id, goalId), eq(goal.userId, userId)))
    .for("no key update");
  if (!g) throw new GoalError("NOT_FOUND", "Goal not found");
  return g;
}

export async function createGoal(db: AppDb, userId: string, input: GoalInput, now = new Date()) {
  return db.transaction(async (tx) => {
    const today = await playerToday(tx, userId, now);
    const [{ active }] = await tx
      .select({ active: count() })
      .from(goal)
      .where(and(eq(goal.userId, userId), eq(goal.status, "active")));
    if (active >= GOAL_RULES.maxActiveGoals) {
      throw new GoalError("LIMIT_REACHED", `You can have up to ${GOAL_RULES.maxActiveGoals} active goals.`);
    }
    const [g] = await tx
      .insert(goal)
      .values({
        userId,
        title: input.title,
        description: input.description,
        category: input.category,
        deadline: input.deadline,
        startDate: today,
      })
      .returning();
    await tx.insert(goalMilestone).values(
      input.milestones.map((title, i) => ({ goalId: g.id, userId, title, position: i })),
    );
    return g;
  });
}

export async function addMilestone(db: AppDb, userId: string, goalId: string, title: string) {
  return db.transaction(async (tx) => {
    const g = await lockOwnedGoal(tx, userId, goalId);
    if (g.status !== "active") throw new GoalError("INVALID_STATE", "Only active goals can change.");
    const existing = await tx.query.goalMilestone.findMany({ where: eq(goalMilestone.goalId, g.id) });
    if (existing.length >= GOAL_RULES.maxMilestones) {
      throw new GoalError("LIMIT_REACHED", `A goal can have up to ${GOAL_RULES.maxMilestones} milestones.`);
    }
    const [m] = await tx
      .insert(goalMilestone)
      .values({ goalId: g.id, userId, title, position: existing.length })
      .returning();
    return m;
  });
}

/** Creates a one-off custom quest for a milestone and links them. */
export async function createQuestForMilestone(db: AppDb, userId: string, milestoneId: string, now = new Date()) {
  const m = await db.query.goalMilestone.findFirst({
    where: and(eq(goalMilestone.id, milestoneId), eq(goalMilestone.userId, userId)),
  });
  if (!m) throw new GoalError("NOT_FOUND", "Milestone not found");
  if (m.completedAt || m.playerQuestId) throw new GoalError("INVALID_STATE", "This milestone already has a quest or is done.");
  const g = await db.query.goal.findFirst({ where: eq(goal.id, m.goalId) });
  if (!g || g.status !== "active") throw new GoalError("INVALID_STATE", "Only active goals can change.");

  const created = await createCustomQuest(
    db,
    userId,
    {
      title: m.title,
      description: `Milestone for “${g.title}”.`,
      category: g.category,
      difficulty: "normal",
      attribute: null,
      xpReward: null,
      scheduleType: "once",
      // The goal's deadline becomes the quest's target date while it's still ahead.
      targetDate: g.deadline && g.deadline >= (await playerToday(db, userId, now)) ? g.deadline : null,
      days: [],
      estimatedMinutes: null,
      checklist: [],
    },
    now,
  );
  if (created.kind !== "once") throw new GoalError("INVALID_STATE", "Unexpected quest type");
  // Conditional update: a racing request can't link two quests to one milestone.
  const [linked] = await db
    .update(goalMilestone)
    .set({ playerQuestId: created.questId })
    .where(and(eq(goalMilestone.id, m.id), isNull(goalMilestone.playerQuestId), isNull(goalMilestone.completedAt)))
    .returning();
  if (!linked) throw new GoalError("INVALID_STATE", "This milestone was linked by another request.");
  return { questId: created.questId };
}

export type MilestoneResult = {
  status: "completed" | "already_completed";
  quest: CompletionResult | null;
  goalCompleted: GoalCompletion | null;
};

/**
 * Marks a milestone done (self-reported). If it is linked to an open quest, the quest is
 * completed instead and its rewards apply; the milestone itself is never rewarded.
 */
export async function completeMilestone(db: AppDb, userId: string, milestoneId: string, now = new Date()): Promise<MilestoneResult> {
  return db.transaction(async (tx) => {
    const m = await tx.query.goalMilestone.findFirst({
      where: and(eq(goalMilestone.id, milestoneId), eq(goalMilestone.userId, userId)),
    });
    if (!m) throw new GoalError("NOT_FOUND", "Milestone not found");
    if (m.completedAt) return { status: "already_completed", quest: null, goalCompleted: null };

    // Linked to an open quest: complete the quest (lock order quest → player → goal, the same
    // as a direct quest completion); its hook marks this milestone and may finish the goal.
    if (m.playerQuestId) {
      const q = await tx.query.playerQuest.findFirst({ where: eq(playerQuest.id, m.playerQuestId) });
      if (q && (q.status === "available" || q.status === "in_progress")) {
        const g = await tx.query.goal.findFirst({ where: and(eq(goal.id, m.goalId), eq(goal.userId, userId)) });
        if (!g || g.status !== "active") throw new GoalError("INVALID_STATE", "This goal is no longer active.");
        const quest = await completeQuest(tx, userId, q.id, { now });
        return { status: quest.status === "completed" ? "completed" : "already_completed", quest, goalCompleted: quest.goal ?? null };
      }
    }

    // Same order as quest completion (quest → player → goal): player first, then goal.
    await lockProgress(tx, userId);
    const g = await lockOwnedGoal(tx, userId, m.goalId);
    if (g.status !== "active") throw new GoalError("INVALID_STATE", "This goal is no longer active.");
    const [marked] = await tx
      .update(goalMilestone)
      .set({ completedAt: now })
      .where(and(eq(goalMilestone.id, m.id), isNull(goalMilestone.completedAt)))
      .returning({ id: goalMilestone.id });
    if (!marked) return { status: "already_completed", quest: null, goalCompleted: null };
    const goalCompleted = await completeGoalIfDone(tx, userId, g.id, now);
    return { status: "completed", quest: null, goalCompleted };
  });
}

export async function archiveGoal(db: AppDb, userId: string, goalId: string) {
  const [row] = await db
    .update(goal)
    .set({ status: "archived" })
    .where(and(eq(goal.id, goalId), eq(goal.userId, userId), ne(goal.status, "archived")))
    .returning({ id: goal.id });
  if (!row) {
    const exists = await db.query.goal.findFirst({ where: and(eq(goal.id, goalId), eq(goal.userId, userId)) });
    if (!exists) throw new GoalError("NOT_FOUND", "Goal not found");
  }
}

/** Goals with milestones, linked quest status and progress — from persisted records only. */
export async function listGoals(db: AppDb, userId: string, today: QuestDate) {
  const goals = await db.query.goal.findMany({
    where: and(eq(goal.userId, userId), ne(goal.status, "archived")),
    orderBy: [asc(goal.status), asc(goal.deadline), asc(goal.createdAt)],
  });
  if (goals.length === 0) return [];
  const milestones = await db.query.goalMilestone.findMany({
    where: and(
      eq(goalMilestone.userId, userId),
      inArray(
        goalMilestone.goalId,
        goals.map((g) => g.id),
      ),
    ),
    orderBy: [asc(goalMilestone.position)],
  });
  const questIds = milestones.flatMap((m) => (m.playerQuestId ? [m.playerQuestId] : []));
  const quests = questIds.length
    ? await db
        .select({ id: playerQuest.id, status: playerQuest.status, title: playerQuest.title })
        .from(playerQuest)
        .where(and(eq(playerQuest.userId, userId), inArray(playerQuest.id, questIds)))
    : [];
  const questById = new Map(quests.map((q) => [q.id, q]));
  return goals.map((g) => {
    const ms = milestones
      .filter((m) => m.goalId === g.id)
      .map((m) => ({ ...m, quest: m.playerQuestId ? (questById.get(m.playerQuestId) ?? null) : null }));
    return {
      goal: g,
      milestones: ms,
      progress: goalProgress(ms),
      overdue: g.status === "active" && !!g.deadline && g.deadline < today,
      rewardPreview: goalRewardCheck({ milestoneCount: ms.length, startDate: g.startDate, today, rewardedToday: 0 }),
    };
  });
}
