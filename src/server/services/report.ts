import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import { attributeLedger, questCompletion, weeklyChallenge, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { ATTRIBUTE_INFO, ATTRIBUTES, CATEGORY_INFO, CATEGORIES, type Attribute } from "@/lib/progression/config";
import { addDays, questDayBounds, type QuestDate } from "@/lib/time";
import { getDayStreak, type PlayerClock } from "./streak";

// The weekly report: last Monday–Sunday in the player's quest days, built from the ledgers.

/** The suggested area for next week: one that grows the player's least-trained attribute. Pure. */
export function suggestFocus(gains: Record<Attribute, number>) {
  const weakest = [...ATTRIBUTES].sort((a, b) => gains[a] - gains[b])[0];
  const category = CATEGORIES.find((c) => CATEGORY_INFO[c].attribute === weakest)!;
  return { attribute: weakest, category };
}

export async function getWeeklyReport(db: AppDb, userId: string, clock: PlayerClock, weekStart: QuestDate) {
  const start = questDayBounds(weekStart, clock.timeZone, clock.dayStartHour).start;
  const end = questDayBounds(addDays(weekStart, 7), clock.timeZone, clock.dayStartHour).start;
  const prevStart = questDayBounds(addDays(weekStart, -7), clock.timeZone, clock.dayStartHour).start;
  const xpDay = sql<string>`((${xpLedger.createdAt} at time zone ${clock.timeZone}) - make_interval(hours => ${clock.dayStartHour}))::date::text`;

  const [byDay, [prev], [quests], attrs, [combos], boss, streak] = await Promise.all([
    db
      .select({ day: xpDay, xp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
      .from(xpLedger)
      .where(and(eq(xpLedger.userId, userId), gte(xpLedger.createdAt, start), lt(xpLedger.createdAt, end)))
      .groupBy(sql`1`),
    db
      .select({ xp: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
      .from(xpLedger)
      .where(and(eq(xpLedger.userId, userId), gte(xpLedger.createdAt, prevStart), lt(xpLedger.createdAt, start))),
    db
      .select({ n: count() })
      .from(questCompletion)
      .where(and(eq(questCompletion.userId, userId), gte(questCompletion.completedAt, start), lt(questCompletion.completedAt, end))),
    db
      .select({ attribute: attributeLedger.attribute, points: sql<number>`coalesce(sum(${attributeLedger.amount}), 0)::int` })
      .from(attributeLedger)
      .where(and(eq(attributeLedger.userId, userId), gte(attributeLedger.createdAt, start), lt(attributeLedger.createdAt, end)))
      .groupBy(attributeLedger.attribute),
    db
      .select({ n: count() })
      .from(xpLedger)
      .where(
        and(
          eq(xpLedger.userId, userId),
          eq(xpLedger.sourceType, "daily_combo"),
          gte(xpLedger.createdAt, start),
          lt(xpLedger.createdAt, end),
        ),
      ),
    db.query.weeklyChallenge.findFirst({
      where: and(eq(weeklyChallenge.userId, userId), eq(weeklyChallenge.weekStart, weekStart), eq(weeklyChallenge.isBoss, true)),
    }),
    getDayStreak(db, userId, clock),
  ]);

  const xpBy = new Map(byDay.map((d) => [d.day, d.xp]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, xp: xpBy.get(date) ?? 0 };
  });
  const totalXp = days.reduce((sum, d) => sum + d.xp, 0);
  const best = days.reduce((a, b) => (b.xp > a.xp ? b : a), days[0]);
  const gains = Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>;
  for (const a of attrs) gains[a.attribute] = a.points;
  const strongest = [...ATTRIBUTES].sort((a, b) => gains[b] - gains[a])[0];
  const suggestion = suggestFocus(gains);

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    totalXp,
    previousXp: prev?.xp ?? 0,
    days,
    bestDay: best.xp > 0 ? best : null,
    questsCompleted: quests?.n ?? 0,
    perfectDays: combos?.n ?? 0,
    boss: boss ? { title: boss.title, defeated: boss.status === "completed", progress: boss.progress, target: boss.target } : null,
    gains,
    strongest: gains[strongest] > 0 ? { attribute: strongest, label: ATTRIBUTE_INFO[strongest].label, points: gains[strongest] } : null,
    suggestion: {
      ...suggestion,
      attributeLabel: ATTRIBUTE_INFO[suggestion.attribute].label,
      categoryLabel: CATEGORY_INFO[suggestion.category].label,
    },
    streak: streak.current,
  };
}

/** Whether the player did anything in a week, so an empty report isn't announced. */
export async function hadActivity(db: AppDb, userId: string, clock: PlayerClock, weekStart: QuestDate) {
  const start = questDayBounds(weekStart, clock.timeZone, clock.dayStartHour).start;
  const end = questDayBounds(addDays(weekStart, 7), clock.timeZone, clock.dayStartHour).start;
  const [row] = await db
    .select({ id: xpLedger.id })
    .from(xpLedger)
    .where(and(eq(xpLedger.userId, userId), gte(xpLedger.createdAt, start), lt(xpLedger.createdAt, end)))
    .limit(1);
  return !!row;
}

