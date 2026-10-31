import { and, asc, between, eq, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import {
  achievement,
  attributeLedger,
  focusSession,
  goal,
  habit,
  habitCompletion,
  playerAchievement,
  playerQuest,
  questCompletion,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { bucketWeekly, cumulative, daysBetween, fillDaily, longestDayRun, ratio } from "@/lib/analytics";
import { ATTRIBUTES, CATEGORY_INFO, type Attribute, type Category } from "@/lib/progression/config";
import { habitRateInRange, habitStats, scheduleOf } from "@/lib/progression/habits";
import { activeDayStreak } from "@/lib/progression/streaks";
import { addDays, questDayBounds, type QuestDate } from "@/lib/time";

// Progress analytics — docs/ARCHITECTURE.md §6f.
// Every number comes from append-only or historical records (XP/attribute ledgers, quest
// completions, quest outcomes, habit check-ins, focus sessions, goals, achievements), bucketed
// by the player's quest day. Nothing is estimated or generated.

/**
 * GROUP BY the first selected column. The day expression is parameterised (time zone, start
 * hour); repeating it in GROUP BY binds fresh parameters, which Postgres treats as a different
 * expression and rejects — so group by position instead.
 */
const BY_FIRST_COLUMN = sql`1`;

export type AnalyticsInput = {
  from: QuestDate;
  to: QuestDate;
  today: QuestDate;
  timeZone: string;
  dayStartHour: number;
};

/** A timestamp's quest day in the player's zone, as YYYY-MM-DD. */
function questDayOf(column: SQL | Parameters<typeof sql>[1], tz: string, startHour: number) {
  return sql<string>`((${column} at time zone ${tz}) - make_interval(hours => ${startHour}))::date::text`;
}

export async function getAnalytics(db: AppDb, userId: string, input: AnalyticsInput) {
  const { from, to, today, timeZone, dayStartHour } = input;
  const start = questDayBounds(from, timeZone, dayStartHour).start;
  const end = questDayBounds(to, timeZone, dayStartHour).end;
  const days = daysBetween(from, to);
  const xpDay = questDayOf(xpLedger.createdAt, timeZone, dayStartHour);
  const completionDay = questDayOf(questCompletion.completedAt, timeZone, dayStartHour);
  const attrDay = questDayOf(attributeLedger.createdAt, timeZone, dayStartHour);

  const [
    xpRows,
    completionRows,
    categoryRows,
    outcomeRows,
    attrBaseline,
    attrRows,
    focusRows,
    habits,
    habitRows,
    goals,
    achievements,
    activeDays,
  ] = await Promise.all([
    db
      .select({ date: xpDay, xp: sql<number>`sum(${xpLedger.amount})::int` })
      .from(xpLedger)
      .where(and(eq(xpLedger.userId, userId), gte(xpLedger.createdAt, start), lt(xpLedger.createdAt, end)))
      .groupBy(BY_FIRST_COLUMN),
    db
      .select({ date: completionDay, completed: sql<number>`count(*)::int` })
      .from(questCompletion)
      .where(and(eq(questCompletion.userId, userId), gte(questCompletion.completedAt, start), lt(questCompletion.completedAt, end)))
      .groupBy(BY_FIRST_COLUMN),
    db
      .select({ category: playerQuest.category, n: sql<number>`count(*)::int` })
      .from(questCompletion)
      .innerJoin(playerQuest, eq(playerQuest.id, questCompletion.playerQuestId))
      .where(and(eq(questCompletion.userId, userId), gte(questCompletion.completedAt, start), lt(questCompletion.completedAt, end)))
      .groupBy(playerQuest.category),
    // Scheduled quests by outcome on their own day (expired/cancelled = missed; open = still today).
    db
      .select({ date: playerQuest.questDate, status: playerQuest.status, n: sql<number>`count(*)::int` })
      .from(playerQuest)
      .where(and(eq(playerQuest.userId, userId), isNotNull(playerQuest.templateId), between(playerQuest.questDate, from, to)))
      .groupBy(playerQuest.questDate, playerQuest.status),
    db
      .select({ attribute: attributeLedger.attribute, points: sql<number>`sum(${attributeLedger.amount})::int` })
      .from(attributeLedger)
      .where(and(eq(attributeLedger.userId, userId), lt(attributeLedger.createdAt, start)))
      .groupBy(attributeLedger.attribute),
    db
      .select({ date: attrDay, attribute: attributeLedger.attribute, points: sql<number>`sum(${attributeLedger.amount})::int` })
      .from(attributeLedger)
      .where(and(eq(attributeLedger.userId, userId), gte(attributeLedger.createdAt, start), lt(attributeLedger.createdAt, end)))
      .groupBy(BY_FIRST_COLUMN, attributeLedger.attribute),
    db
      .select({
        date: focusSession.startDate,
        minutes: sql<number>`round(sum(${focusSession.creditedSeconds}) / 60.0)::int`,
        sessions: sql<number>`count(*) filter (where ${focusSession.status} = 'completed')::int`,
      })
      .from(focusSession)
      .where(and(eq(focusSession.userId, userId), between(focusSession.startDate, from, to)))
      .groupBy(focusSession.startDate),
    // Habits that existed in the window, including archived ones (their history still counts).
    db.query.habit.findMany({ where: and(eq(habit.userId, userId), sql`${habit.startDate} <= ${to}`), orderBy: [asc(habit.createdAt)] }),
    db
      .select({ habitId: habitCompletion.habitId, date: habitCompletion.localDate })
      .from(habitCompletion)
      .where(and(eq(habitCompletion.userId, userId), gte(habitCompletion.localDate, addDays(today, -400)))),
    db.query.goal.findMany({
      where: and(eq(goal.userId, userId), eq(goal.status, "completed"), gte(goal.completedAt, start), lt(goal.completedAt, end)),
      orderBy: [asc(goal.completedAt)],
    }),
    db
      .select({ code: achievement.code, name: achievement.name, icon: achievement.icon, unlockedAt: playerAchievement.unlockedAt })
      .from(playerAchievement)
      .innerJoin(achievement, eq(achievement.code, playerAchievement.achievementCode))
      .where(and(eq(playerAchievement.userId, userId), gte(playerAchievement.unlockedAt, start), lt(playerAchievement.unlockedAt, end)))
      .orderBy(asc(playerAchievement.unlockedAt)),
    db
      .selectDistinct({ date: completionDay })
      .from(questCompletion)
      .where(and(eq(questCompletion.userId, userId), gte(questCompletion.completedAt, questDayBounds(addDays(today, -400), timeZone, dayStartHour).start))),
  ]);

  // XP per day (+ running total within the window).
  const xpDaily = fillDaily(days, xpRows, ["xp"] as const);

  // Quests: completions per day (any quest) and scheduled-quest outcomes.
  const outcomes = new Map<QuestDate, { completed: number; missed: number }>();
  for (const r of outcomeRows) {
    const o = outcomes.get(r.date) ?? { completed: 0, missed: 0 };
    if (r.status === "completed") o.completed += r.n;
    else if (r.status === "expired" || r.status === "cancelled") o.missed += r.n;
    outcomes.set(r.date, o);
  }
  const questDaily = days.map((date) => ({ date, ...(outcomes.get(date) ?? { completed: 0, missed: 0 }) }));
  const scheduledDone = questDaily.reduce((s, d) => s + d.completed, 0);
  const scheduledMissed = questDaily.reduce((s, d) => s + d.missed, 0);
  const completions = fillDaily(days, completionRows, ["completed"] as const);

  // Attributes: cumulative points, starting from everything earned before the window.
  const base = Object.fromEntries(attrBaseline.map((r) => [r.attribute, r.points])) as Partial<Record<Attribute, number>>;
  const attrByDay = new Map<QuestDate, Partial<Record<Attribute, number>>>();
  for (const r of attrRows) attrByDay.set(r.date, { ...attrByDay.get(r.date), [r.attribute]: r.points });
  const attributeDaily = cumulative(
    days.map((date) => ({ date, ...Object.fromEntries(ATTRIBUTES.map((a) => [a, attrByDay.get(date)?.[a] ?? 0])) })) as ({
      date: QuestDate;
    } & Record<Attribute, number>)[],
    ATTRIBUTES,
    base,
  );

  const focusDaily = fillDaily(days, focusRows, ["minutes", "sessions"] as const);

  // Habits: rate inside the window plus streaks (archived habits keep their history).
  const datesByHabit = new Map<string, QuestDate[]>();
  for (const r of habitRows) datesByHabit.set(r.habitId, [...(datesByHabit.get(r.habitId) ?? []), r.date]);
  const habitSummaries = habits.map((h) => {
    const schedule = scheduleOf(h);
    const dates = datesByHabit.get(h.id) ?? [];
    const stats = habitStats(schedule, dates, h.startDate, today);
    return {
      id: h.id,
      name: h.name,
      archived: !!h.archivedAt,
      unit: stats.unit,
      current: h.archivedAt ? 0 : stats.current,
      longest: stats.longest,
      ...habitRateInRange(schedule, dates, h.startDate, from, to, today),
    };
  });
  const habitCheckIns = habitRows.filter((r) => r.date >= from && r.date <= to).length;

  const categories = (categoryRows as { category: Category; n: number }[])
    .map((r) => ({ category: r.category, label: CATEGORY_INFO[r.category].label, completed: r.n }))
    .sort((a, b) => b.completed - a.completed);

  const long = days.length > 60;
  return {
    days: days.length,
    weekly: long,
    xp: long ? bucketWeekly(xpDaily, ["xp"] as const) : xpDaily,
    quests: long ? bucketWeekly(questDaily, ["completed", "missed"] as const) : questDaily,
    focus: long ? bucketWeekly(focusDaily, ["minutes", "sessions"] as const) : focusDaily,
    attributes: attributeDaily,
    categories,
    habits: habitSummaries,
    goals: goals.map((g) => ({ id: g.id, title: g.title, completedAt: g.completedAt! })),
    achievements,
    totals: {
      xp: xpDaily.reduce((s, d) => s + d.xp, 0),
      questsCompleted: completions.reduce((s, d) => s + d.completed, 0),
      scheduledRate: ratio(scheduledDone, scheduledDone + scheduledMissed),
      habitCheckIns,
      focusMinutes: focusDaily.reduce((s, d) => s + d.minutes, 0),
      focusSessions: focusDaily.reduce((s, d) => s + d.sessions, 0),
      goalsCompleted: goals.length,
      achievements: achievements.length,
      currentStreak: activeDayStreak(activeDays.map((d) => d.date), today),
      longestStreakInRange: longestDayRun(activeDays.map((d) => d.date).filter((d) => d >= from && d <= to)),
    },
  };
}

export type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

