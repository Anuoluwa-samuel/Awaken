import { and, asc, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  habit,
  habitCompletion,
  playerProfile,
  playerProgress,
  playerQuest,
  playerQuestSchedule,
  questTemplate,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { CATEGORY_INFO, HABIT_RULES, type Attribute } from "@/lib/progression/config";
import { checkInCounts, habitCalendar, habitStats, scheduleOf } from "@/lib/progression/habits";
import { applyXp, type ProgressionChange } from "@/lib/progression/rewards";
import { addDays, questDay, type QuestDate } from "@/lib/time";
import type { HabitInput } from "@/lib/validation/habit";
import { evaluateAchievements, type UnlockedAchievement } from "./achievements";
import { completeQuest, type CompletionResult } from "./quests";
import { grantAttribute, grantXp, lockProgress } from "./rewards";

// Habits — docs/ARCHITECTURE.md §6c.
//
// A habit check-in and a quest completion are different records. When a habit is linked
// to a quest template, checking in completes today's quest from that template and only the
// quest's rewards are granted; completing that quest directly also records the check-in.
// Unlinked check-ins earn the small habit reward, but only when they count toward the
// schedule (a scheduled weekday, or within the weekly target). Missing a day can reset a
// streak; it never touches XP.

export class HabitError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "ARCHIVED" | "LIMIT_REACHED" | "INVALID_LINK" | "PLAYER_NOT_FOUND",
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
  if (!profile) throw new HabitError("PLAYER_NOT_FOUND", "Player profile not found");
  return questDay(now, profile.timeZone, profile.dayStartHour);
}

/** Daily quest templates the player has scheduled — the only valid link targets. */
export async function listLinkableTemplates(db: AppDb, userId: string) {
  return db
    .select({ id: questTemplate.id, title: questTemplate.title, category: questTemplate.category })
    .from(playerQuestSchedule)
    .innerJoin(questTemplate, eq(questTemplate.id, playerQuestSchedule.templateId))
    .where(
      and(
        eq(playerQuestSchedule.userId, userId),
        eq(playerQuestSchedule.isActive, true),
        eq(questTemplate.cadence, "daily"),
        sql`(${questTemplate.ownerUserId} is null or ${questTemplate.ownerUserId} = ${userId})`,
      ),
    )
    .orderBy(asc(questTemplate.title));
}

export async function createHabit(db: AppDb, userId: string, input: HabitInput, now = new Date()) {
  return db.transaction(async (tx) => {
    const today = await playerToday(tx, userId, now);
    const [{ active }] = await tx
      .select({ active: count() })
      .from(habit)
      .where(and(eq(habit.userId, userId), isNull(habit.archivedAt)));
    if (active >= HABIT_RULES.maxActiveHabits) {
      throw new HabitError("LIMIT_REACHED", `You can track up to ${HABIT_RULES.maxActiveHabits} habits at once.`);
    }
    if (input.linkedTemplateId) {
      const linkable = await listLinkableTemplates(tx, userId);
      if (!linkable.some((t) => t.id === input.linkedTemplateId)) {
        throw new HabitError("INVALID_LINK", "That quest isn't one of your scheduled daily quests.");
      }
    }
    const weekly = input.scheduleType === "weekly";
    const [created] = await tx
      .insert(habit)
      .values({
        userId,
        name: input.name,
        description: input.description,
        category: input.category,
        attribute: input.attribute ?? CATEGORY_INFO[input.category].attribute,
        scheduleDays: weekly ? [0, 1, 2, 3, 4, 5, 6] : [...new Set(input.days)].sort(),
        timesPerWeek: weekly ? input.timesPerWeek : null,
        startDate: today,
        linkedTemplateId: input.linkedTemplateId,
      })
      .returning();
    return created;
  });
}

export async function archiveHabit(db: AppDb, userId: string, habitId: string, now = new Date()) {
  const [row] = await db
    .update(habit)
    .set({ archivedAt: now })
    .where(and(eq(habit.id, habitId), eq(habit.userId, userId), isNull(habit.archivedAt)))
    .returning({ id: habit.id });
  if (!row) {
    const exists = await db.query.habit.findFirst({ where: and(eq(habit.id, habitId), eq(habit.userId, userId)) });
    if (!exists) throw new HabitError("NOT_FOUND", "Habit not found");
  }
}

export type CheckInResult =
  | { status: "already_checked_in"; date: QuestDate }
  | {
      status: "checked_in";
      date: QuestDate;
      /** "quest": the linked quest was completed and only its rewards applied. */
      via: "habit" | "quest";
      counted: boolean;
      xp: { granted: number; note: string | null };
      attributes: { attribute: Attribute; granted: number }[];
      levelChange: ProgressionChange | null;
      achievements: UnlockedAchievement[];
      quest: CompletionResult | null;
    };

async function levelChangeSince(tx: AppDb, userId: string, beforeXp: number) {
  const after = await tx.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
  const change = applyXp(beforeXp, (after?.totalXp ?? beforeXp) - beforeXp);
  return change.levelsGained > 0 ? change : null;
}

/** Records today's check-in exactly once and applies the documented reward rule. */
export async function checkInHabit(db: AppDb, userId: string, habitId: string, now = new Date()): Promise<CheckInResult> {
  return db.transaction(async (tx) => {
    // Lock order: habit row → (quest row → player row, inside completeQuest).
    // NO KEY UPDATE, not UPDATE: check-ins for this habit still serialize, but a quest
    // completion recording a linked check-in (an FK insert, which takes KEY SHARE on this
    // row) is not blocked — otherwise the two would deadlock on habit ↔ quest.
    const [h] = await tx
      .select()
      .from(habit)
      .where(and(eq(habit.id, habitId), eq(habit.userId, userId)))
      .for("no key update");
    if (!h) throw new HabitError("NOT_FOUND", "Habit not found");
    if (h.archivedAt) throw new HabitError("ARCHIVED", "This habit is archived");

    const today = await playerToday(tx, userId, now);
    const already = await tx.query.habitCompletion.findFirst({
      where: and(eq(habitCompletion.habitId, h.id), eq(habitCompletion.localDate, today)),
      columns: { id: true },
    });
    if (already) return { status: "already_checked_in", date: today };

    // Linked: complete today's quest from the template; its rewards are the only rewards.
    if (h.linkedTemplateId) {
      const quest = await tx.query.playerQuest.findFirst({
        where: and(
          eq(playerQuest.userId, userId),
          eq(playerQuest.templateId, h.linkedTemplateId),
          eq(playerQuest.questDate, today),
          inArray(playerQuest.status, ["available", "in_progress"]),
        ),
        columns: { id: true },
      });
      if (quest) {
        const result = await completeQuest(tx, userId, quest.id, { method: "habit", now });
        // A racing direct completion got there first and already recorded this check-in.
        if (result.status === "already_completed") return { status: "already_checked_in", date: today };
        // completeQuest records the check-in for linked habits; make sure of it.
        await tx.insert(habitCompletion).values({ habitId: h.id, userId, localDate: today, completedAt: now }).onConflictDoNothing();
        return {
          status: "checked_in",
          date: today,
          via: "quest",
          counted: true,
          xp: { granted: result.xp.granted, note: result.xp.note },
          attributes: result.attributes,
          levelChange: result.levelChange,
          achievements: result.achievements,
          quest: result,
        };
      }
    }

    const before = await lockProgress(tx, userId);
    const history = await tx
      .select({ date: habitCompletion.localDate })
      .from(habitCompletion)
      .where(and(eq(habitCompletion.habitId, h.id), gte(habitCompletion.localDate, addDays(today, -7))));
    const counted = checkInCounts(scheduleOf(h), new Set(history.map((r) => r.date)), today);

    const [inserted] = await tx
      .insert(habitCompletion)
      .values({ habitId: h.id, userId, localDate: today, completedAt: now })
      .onConflictDoNothing()
      .returning({ id: habitCompletion.id });
    if (!inserted) return { status: "already_checked_in", date: today };

    if (!counted) {
      const achievements = await evaluateAchievements(tx, userId, now);
      return {
        status: "checked_in",
        date: today,
        via: "habit",
        counted: false,
        xp: {
          granted: 0,
          note: h.timesPerWeek
            ? "Weekly target already met — recorded as a bonus check-in."
            : "Rest day — recorded, no reward needed.",
        },
        attributes: [],
        levelChange: await levelChangeSince(tx, userId, before.totalXp),
        achievements,
        quest: null,
      };
    }

    const xp = await grantXp(tx, {
      userId,
      eventType: "habit_completed",
      sourceType: "habit",
      sourceId: h.id,
      amount: HABIT_RULES.xp,
      reason: `Habit: ${h.name}`,
      idempotencyKey: `habit:${h.id}:${today}`,
      now,
    });
    const attr = await grantAttribute(tx, {
      userId,
      attribute: h.attribute,
      amount: HABIT_RULES.attributePoints,
      sourceType: "habit",
      sourceId: h.id,
      idempotencyKey: `habit:${h.id}:${today}:attr`,
      now,
    });
    const achievements = await evaluateAchievements(tx, userId, now);
    return {
      status: "checked_in",
      date: today,
      via: "habit",
      counted: true,
      xp: xp.status === "granted" ? { granted: xp.granted, note: null } : { granted: 0, note: "Already rewarded." },
      attributes: attr.status === "granted" ? [{ attribute: h.attribute, granted: attr.granted }] : [],
      levelChange: await levelChangeSince(tx, userId, before.totalXp),
      achievements,
      quest: null,
    };
  });
}

/** Active habits with stats and a 12-week calendar, computed from persisted check-ins. */
export async function listHabits(db: AppDb, userId: string, today: QuestDate) {
  const habits = await db.query.habit.findMany({
    where: and(eq(habit.userId, userId), isNull(habit.archivedAt)),
    orderBy: [asc(habit.createdAt)],
  });
  if (habits.length === 0) return [];
  const rows = await db
    .select({ habitId: habitCompletion.habitId, date: habitCompletion.localDate })
    .from(habitCompletion)
    .where(
      and(
        eq(habitCompletion.userId, userId),
        inArray(
          habitCompletion.habitId,
          habits.map((h) => h.id),
        ),
        gte(habitCompletion.localDate, addDays(today, -HABIT_RULES.historyDays)),
      ),
    );
  const byHabit = new Map<string, QuestDate[]>();
  for (const r of rows) byHabit.set(r.habitId, [...(byHabit.get(r.habitId) ?? []), r.date]);

  const linkedIds = habits.flatMap((h) => (h.linkedTemplateId ? [h.linkedTemplateId] : []));
  const templates = linkedIds.length
    ? await db
        .select({ id: questTemplate.id, title: questTemplate.title })
        .from(questTemplate)
        .where(inArray(questTemplate.id, linkedIds))
    : [];
  const templateTitle = new Map(templates.map((t) => [t.id, t.title]));

  return habits.map((h) => {
    const schedule = scheduleOf(h);
    const dates = byHabit.get(h.id) ?? [];
    return {
      habit: h,
      schedule,
      linkedQuestTitle: h.linkedTemplateId ? (templateTitle.get(h.linkedTemplateId) ?? null) : null,
      stats: habitStats(schedule, dates, h.startDate, today),
      calendar: habitCalendar(schedule, dates, h.startDate, today, 12),
    };
  });
}
