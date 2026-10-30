import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import {
  attributeLedger,
  playerProfile,
  playerProgress,
  playerQuest,
  playerQuestSchedule,
  questCompletion,
  questTemplate,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import {
  CATEGORY_INFO,
  DIFFICULTY_ATTRIBUTE_POINTS,
  LIMITS,
  QUEST_LIMITS,
  type Attribute,
} from "@/lib/progression/config";
import { levelProgress, rankProgress, type LevelProgress, type RankProgress } from "@/lib/progression/levels";
import { canTransition, OPEN_STATUSES } from "@/lib/progression/quest-state";
import { applyXp, resolveQuestXp, type ProgressionChange } from "@/lib/progression/rewards";
import { dayOfWeek, questDay, questDayBounds, type QuestDate } from "@/lib/time";
import type { CustomQuestInput } from "@/lib/validation/quest";
import { evaluateAchievements, type UnlockedAchievement } from "./achievements";
import { recordMilestonesForQuest, type GoalCompletion } from "./goal-links";
import { recordLinkedHabitCheckIns } from "./habit-links";
import { grantAttribute, grantXp, lockProgress } from "./rewards";
import { advanceWeeklyChallenges, type WeeklyAdvance } from "./weekly";

export class QuestError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "INVALID_STATE"
      | "NOT_TODAY"
      | "PAST_DUE"
      | "LIMIT_REACHED"
      | "PLAYER_NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

async function loadClock(tx: AppDb, userId: string, now: Date) {
  const profile = await tx.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { timeZone: true, dayStartHour: true },
  });
  if (!profile) throw new QuestError("PLAYER_NOT_FOUND", "Player profile not found");
  const today = questDay(now, profile.timeZone, profile.dayStartHour);
  return { ...profile, today, ...questDayBounds(today, profile.timeZone, profile.dayStartHour) };
}

// ─── Daily rollover ──────────────────────────────────────────────────────────

/**
 * Idempotently prepares today's quests for a player (docs/ARCHITECTURE.md §6):
 * expires unfinished scheduled quests from earlier days and one-off custom quests
 * past their deadline, then inserts today's scheduled set. Safe to call on every
 * request and concurrently — the unique index on (user_id, template_id, quest_date)
 * prevents duplicates.
 */
export async function ensureDailyQuests(db: AppDb, userId: string, now = new Date()): Promise<QuestDate> {
  return db.transaction(async (tx) => {
    const { today, end } = await loadClock(tx, userId, now);

    await tx
      .update(playerQuest)
      .set({ status: "expired" })
      .where(
        and(
          eq(playerQuest.userId, userId),
          isNotNull(playerQuest.templateId),
          lt(playerQuest.questDate, today),
          inArray(playerQuest.status, OPEN_STATUSES),
        ),
      );
    await tx
      .update(playerQuest)
      .set({ status: "expired" })
      .where(
        and(
          eq(playerQuest.userId, userId),
          isNull(playerQuest.templateId),
          lte(playerQuest.dueAt, now),
          inArray(playerQuest.status, OPEN_STATUSES),
        ),
      );

    const dow = dayOfWeek(today);
    const scheduled = await tx
      .select({ template: questTemplate })
      .from(playerQuestSchedule)
      .innerJoin(questTemplate, eq(questTemplate.id, playerQuestSchedule.templateId))
      .where(
        and(
          eq(playerQuestSchedule.userId, userId),
          eq(playerQuestSchedule.isActive, true),
          eq(questTemplate.isActive, true),
          eq(questTemplate.cadence, "daily"),
          // A player may only schedule system templates or their own.
          sql`(${questTemplate.ownerUserId} is null or ${questTemplate.ownerUserId} = ${userId})`,
          // Skill-gated templates only once the skill is unlocked.
          sql`(${questTemplate.requiredSkill} is null or exists (select 1 from player_skill ps where ps.user_id = ${userId} and ps.skill_code = ${questTemplate.requiredSkill}))`,
          sql`(cardinality(${playerQuestSchedule.days}) = 0 or ${dow} = any(${playerQuestSchedule.days}))`,
        ),
      );

    if (scheduled.length > 0) {
      await tx
        .insert(playerQuest)
        .values(
          scheduled.map(({ template: t }) => ({
            userId,
            templateId: t.id,
            // Player-authored recurring quests stay "custom" so custom safeguards apply.
            kind: t.ownerUserId ? ("custom" as const) : ("daily" as const),
            title: t.title,
            description: t.description,
            category: t.category,
            difficulty: t.difficulty,
            attribute: t.attribute,
            xpReward: resolveQuestXp(t.difficulty, t.xpReward),
            estimatedMinutes: t.estimatedMinutes,
            questDate: today,
            dueAt: end,
          })),
        )
        .onConflictDoNothing({
          target: [playerQuest.userId, playerQuest.templateId, playerQuest.questDate],
        });
    }

    return today;
  });
}

export async function listQuestsForDay(db: AppDb, userId: string, date: QuestDate) {
  return db.query.playerQuest.findMany({
    where: and(eq(playerQuest.userId, userId), eq(playerQuest.questDate, date)),
    orderBy: (q, { asc }) => [asc(q.status), asc(q.createdAt)],
  });
}

/** Open one-off custom quests (they persist across days until done, cancelled or past due). */
export async function listOpenOneOffQuests(db: AppDb, userId: string) {
  return db.query.playerQuest.findMany({
    where: and(
      eq(playerQuest.userId, userId),
      isNull(playerQuest.templateId),
      inArray(playerQuest.status, OPEN_STATUSES),
    ),
    orderBy: [asc(playerQuest.dueAt), asc(playerQuest.createdAt)],
    limit: QUEST_LIMITS.maxOpenCustomQuests,
  });
}

/** A quest owned by this player, with its completion and reward history. */
export async function getQuestDetail(db: AppDb, userId: string, questId: string) {
  const quest = await db.query.playerQuest.findFirst({
    where: and(eq(playerQuest.id, questId), eq(playerQuest.userId, userId)),
  });
  if (!quest) return null;
  const [completion, xp, attributes] = await Promise.all([
    db.query.questCompletion.findFirst({ where: eq(questCompletion.playerQuestId, questId) }),
    db.query.xpLedger.findMany({
      where: and(eq(xpLedger.userId, userId), eq(xpLedger.sourceType, "player_quest"), eq(xpLedger.sourceId, questId)),
      orderBy: [desc(xpLedger.createdAt)],
    }),
    db.query.attributeLedger.findMany({
      where: and(
        eq(attributeLedger.userId, userId),
        eq(attributeLedger.sourceType, "player_quest"),
        eq(attributeLedger.sourceId, questId),
      ),
    }),
  ]);
  return { quest, completion: completion ?? null, xp, attributes };
}

// ─── State changes ───────────────────────────────────────────────────────────

/** Locks a quest row, scoped to its owner. Another player's quest is indistinguishable from a missing one. */
async function lockOwnedQuest(tx: AppDb, userId: string, questId: string) {
  const [quest] = await tx
    .select()
    .from(playerQuest)
    .where(and(eq(playerQuest.id, questId), eq(playerQuest.userId, userId)))
    .for("update");
  if (!quest) throw new QuestError("NOT_FOUND", "Quest not found");
  return quest;
}

export async function startQuest(db: AppDb, userId: string, questId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const quest = await lockOwnedQuest(tx, userId, questId);
    if (quest.status === "in_progress") return quest;
    if (!canTransition(quest.status, "start")) {
      throw new QuestError("INVALID_STATE", `A ${quest.status} quest cannot be started`);
    }
    const [updated] = await tx
      .update(playerQuest)
      .set({ status: "in_progress", startedAt: now })
      .where(eq(playerQuest.id, quest.id))
      .returning();
    return updated;
  });
}

export async function cancelQuest(db: AppDb, userId: string, questId: string) {
  return db.transaction(async (tx) => {
    const quest = await lockOwnedQuest(tx, userId, questId);
    if (quest.status === "cancelled") return quest;
    if (!canTransition(quest.status, "cancel")) {
      throw new QuestError("INVALID_STATE", `A ${quest.status} quest cannot be cancelled`);
    }
    const [updated] = await tx
      .update(playerQuest)
      .set({ status: "cancelled" })
      .where(eq(playerQuest.id, quest.id))
      .returning();
    return updated;
  });
}

export type CompletionResult = {
  status: "completed" | "already_completed";
  questId: string;
  questTitle: string;
  xp: { requested: number; granted: number; note: string | null };
  attributes: { attribute: Attribute; granted: number }[];
  levelChange: ProgressionChange | null;
  weekly: WeeklyAdvance[];
  achievements: UnlockedAchievement[];
  /** Set when this completion finished a goal through its linked milestone. */
  goal?: GoalCompletion | null;
  player: { level: LevelProgress; rank: RankProgress };
};

async function playerSnapshot(tx: AppDb, userId: string) {
  const progress = await tx.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
  const totalXp = progress?.totalXp ?? 0;
  return { level: levelProgress(totalXp), rank: rankProgress(totalXp) };
}

/**
 * Completes a quest and grants its rewards exactly once (docs/ARCHITECTURE.md §7).
 * Retries, double clicks and parallel requests return "already_completed" without
 * granting anything. Completions are self-reported unless `method` says otherwise.
 */
export async function completeQuest(
  db: AppDb,
  userId: string,
  questId: string,
  opts: { evidenceNote?: string; method?: "self_reported" | "focus_session" | "habit"; now?: Date } = {},
): Promise<CompletionResult> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    // 1. Ownership + row lock: concurrent requests for this quest serialize here.
    const quest = await lockOwnedQuest(tx, userId, questId);

    if (quest.status === "completed") {
      return {
        status: "already_completed",
        questId,
        questTitle: quest.title,
        xp: { requested: quest.xpReward, granted: 0, note: "Already completed — rewards were granted once." },
        attributes: [],
        levelChange: null,
        weekly: [],
        achievements: [],
        player: await playerSnapshot(tx, userId),
      };
    }
    // 2. State.
    if (!canTransition(quest.status, "complete")) {
      throw new QuestError("INVALID_STATE", `This quest is ${quest.status} and can no longer be completed`);
    }
    // 3. Eligibility by date.
    const clock = await loadClock(tx, userId, now);
    if (quest.templateId && quest.questDate !== clock.today) {
      throw new QuestError("NOT_TODAY", "Scheduled quests can only be completed on their own day");
    }
    if (quest.dueAt && quest.dueAt <= now) {
      throw new QuestError("PAST_DUE", "This quest's deadline has passed");
    }

    // 4. Custom-quest safeguard: rewarded completions per category per day. Counted under
    //    the player lock so parallel completions of different quests can't all slip under it.
    const before = await lockProgress(tx, userId);
    let requested = quest.xpReward;
    let customNote: string | null = null;
    if (quest.kind === "custom") {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(questCompletion)
        .innerJoin(playerQuest, eq(playerQuest.id, questCompletion.playerQuestId))
        .where(
          and(
            eq(questCompletion.userId, userId),
            eq(playerQuest.kind, "custom"),
            eq(playerQuest.category, quest.category),
            gte(questCompletion.completedAt, clock.start),
            lt(questCompletion.completedAt, clock.end),
          ),
        );
      if (n >= LIMITS.customCompletionsPerCategoryPerDay) {
        requested = 0;
        customNote = `Custom ${CATEGORY_INFO[quest.category].label.toLowerCase()} quests are limited to ${LIMITS.customCompletionsPerCategoryPerDay} rewarded completions per day — recorded without XP.`;
      }
    }

    // 5. Record the completion (unique per quest — the second guard).
    await tx.insert(questCompletion).values({
      playerQuestId: quest.id,
      userId,
      method: opts.method ?? "self_reported",
      evidenceNote: opts.evidenceNote || null,
      completedAt: now,
    });
    await tx
      .update(playerQuest)
      .set({ status: "completed", completedAt: now })
      .where(eq(playerQuest.id, quest.id));
    // Habits standing for this quest are checked in too (no extra reward).
    if (quest.templateId) await recordLinkedHabitCheckIns(tx, userId, quest.templateId, clock.today, now);

    // 6. XP (unique ledger key — the third guard; daily cap applied inside).
    const xp = await grantXp(tx, {
      userId,
      eventType: "quest_completed",
      sourceType: "player_quest",
      sourceId: quest.id,
      amount: requested,
      reason: customNote ? `Quest: ${quest.title} (${customNote})` : `Quest: ${quest.title}`,
      idempotencyKey: `quest:${quest.id}`,
      now,
    });

    // 7. Attributes.
    const attributes: CompletionResult["attributes"] = [];
    if (requested > 0) {
      const main = await grantAttribute(tx, {
        userId,
        attribute: quest.attribute,
        amount: DIFFICULTY_ATTRIBUTE_POINTS[quest.difficulty],
        sourceType: "player_quest",
        sourceId: quest.id,
        idempotencyKey: `quest:${quest.id}:attr:${quest.attribute}`,
        now,
      });
      if (main.status === "granted") attributes.push({ attribute: quest.attribute, granted: main.granted });
      if (quest.kind === "daily") {
        const bonus = await grantAttribute(tx, {
          userId,
          attribute: "discipline",
          amount: LIMITS.dailyQuestDisciplineBonus,
          sourceType: "player_quest",
          sourceId: quest.id,
          idempotencyKey: `quest:${quest.id}:attr:discipline-bonus`,
          now,
        });
        if (bonus.status === "granted") attributes.push({ attribute: "discipline", granted: bonus.granted });
      }
    }

    // 8. Weekly challenges.
    const weekly = await advanceWeeklyChallenges(tx, userId, quest.category, now);

    // 9. Goal milestones linked to this quest (may complete a goal and grant its reward).
    const goalCompleted = await recordMilestonesForQuest(tx, userId, quest.id, now);

    // 10. Achievements (their XP can level the player up, so measure the level change after).
    const achievements = [...(goalCompleted?.achievements ?? []), ...(await evaluateAchievements(tx, userId, now))];

    // Level change across everything this completion granted (quest + weekly + achievements).
    const after = await tx.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
    const gained = (after?.totalXp ?? before.totalXp) - before.totalXp;
    const change = applyXp(before.totalXp, gained);

    return {
      status: "completed",
      questId,
      questTitle: quest.title,
      xp:
        xp.status === "granted"
          ? { requested: quest.xpReward, granted: xp.granted, note: customNote ?? xp.capReason }
          : { requested: quest.xpReward, granted: 0, note: "Already rewarded." },
      attributes,
      levelChange: change.levelsGained > 0 ? change : null,
      weekly,
      achievements,
      goal: goalCompleted,
      player: await playerSnapshot(tx, userId),
    };
  });
}

// ─── Custom quest builder ────────────────────────────────────────────────────

/**
 * Creates a player-authored quest. The reward is resolved and snapshotted here
 * (clamped to the difficulty's bounds) and never changes afterwards.
 * - once: a one-off quest, open until done, cancelled, or past its target date.
 * - recurring: a private template + schedule; one quest per scheduled day.
 */
export async function createCustomQuest(db: AppDb, userId: string, input: CustomQuestInput, now = new Date()) {
  const created = await db.transaction(async (tx) => {
    const clock = await loadClock(tx, userId, now);
    const attribute = input.attribute ?? CATEGORY_INFO[input.category].attribute;
    const xpReward = resolveQuestXp(input.difficulty, input.xpReward);

    if (input.scheduleType === "once") {
      const [{ open }] = await tx
        .select({ open: count() })
        .from(playerQuest)
        .where(
          and(
            eq(playerQuest.userId, userId),
            isNull(playerQuest.templateId),
            inArray(playerQuest.status, OPEN_STATUSES),
          ),
        );
      if (open >= QUEST_LIMITS.maxOpenCustomQuests) {
        throw new QuestError("LIMIT_REACHED", `You can have up to ${QUEST_LIMITS.maxOpenCustomQuests} open custom quests.`);
      }
      if (input.targetDate && input.targetDate < clock.today) {
        throw new QuestError("PAST_DUE", "The target date is already in the past");
      }
      const [quest] = await tx
        .insert(playerQuest)
        .values({
          userId,
          kind: "custom",
          title: input.title,
          description: input.description,
          category: input.category,
          difficulty: input.difficulty,
          attribute,
          xpReward,
          questDate: clock.today,
          dueAt: input.targetDate
            ? questDayBounds(input.targetDate, clock.timeZone, clock.dayStartHour).end
            : null,
          estimatedMinutes: input.estimatedMinutes,
          checklist: input.checklist.length ? input.checklist.map((label) => ({ label, done: false })) : null,
        })
        .returning({ id: playerQuest.id });
      return { kind: "once" as const, questId: quest.id, xpReward };
    }

    const [{ recurring }] = await tx
      .select({ recurring: count() })
      .from(playerQuestSchedule)
      .innerJoin(questTemplate, eq(questTemplate.id, playerQuestSchedule.templateId))
      .where(
        and(
          eq(playerQuestSchedule.userId, userId),
          eq(playerQuestSchedule.isActive, true),
          eq(questTemplate.ownerUserId, userId),
        ),
      );
    if (recurring >= QUEST_LIMITS.maxRecurringCustomQuests) {
      throw new QuestError(
        "LIMIT_REACHED",
        `You can have up to ${QUEST_LIMITS.maxRecurringCustomQuests} recurring custom quests.`,
      );
    }
    const [template] = await tx
      .insert(questTemplate)
      .values({
        ownerUserId: userId,
        title: input.title,
        description: input.description,
        category: input.category,
        difficulty: input.difficulty,
        attribute,
        xpReward,
        estimatedMinutes: input.estimatedMinutes,
        cadence: "daily",
      })
      .returning({ id: questTemplate.id });
    await tx.insert(playerQuestSchedule).values({
      userId,
      templateId: template.id,
      days: [...new Set(input.days)].sort(),
    });
    return { kind: "recurring" as const, templateId: template.id, xpReward };
  });

  if (created.kind === "recurring") await ensureDailyQuests(db, userId, now);
  return created;
}
