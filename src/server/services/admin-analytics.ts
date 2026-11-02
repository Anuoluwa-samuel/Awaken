import { and, count, countDistinct, desc, eq, gt, gte, isNotNull, lte, sql, sum } from "drizzle-orm";
import {
  achievement,
  authLockout,
  focusSession,
  goal,
  habitCompletion,
  playerAchievement,
  playerProfile,
  playerProgress,
  playerQuest,
  playerSkill,
  questCompletion,
  user,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { fillDaily } from "@/lib/analytics";
import { addDays } from "@/lib/time";

const DAY_MS = 86_400_000;
export const ADMIN_TREND_DAYS = 30;

const n = (value: unknown) => Number(value ?? 0);
const utcDate = (date: Date) => date.toISOString().slice(0, 10);
const dayOf = (column: unknown) => sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;

/**
 * Site-wide figures for the admin dashboard. Everything here is an aggregate: no names, emails or
 * per-player rows ever leave this function. "Active" means earned XP (completed a quest, habit,
 * focus session, goal or achievement) in the window. Trend days are UTC.
 */
export async function getAdminAnalytics(db: AppDb, now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const today = utcDate(now);
  const days = Array.from({ length: ADMIN_TREND_DAYS }, (_, i) => addDays(today, i - ADMIN_TREND_DAYS + 1));
  const trendStart = new Date(`${days[0]}T00:00:00Z`);

  const accounts = async (since?: Date) =>
    n((await db.select({ v: count() }).from(user).where(since ? gte(user.createdAt, since) : undefined))[0]?.v);
  const active = async (since: Date) =>
    n((await db.select({ v: countDistinct(xpLedger.userId) }).from(xpLedger).where(gte(xpLedger.createdAt, since)))[0]?.v);

  const [totalAccounts, new7, new30, active1, active7, active30] = await Promise.all([
    accounts(),
    accounts(ago(7)),
    accounts(ago(30)),
    active(ago(1)),
    active(ago(7)),
    active(ago(30)),
  ]);

  const [[players], [xp], [quests], [habits], [focus], [goals], [achievements], [skills]] = await Promise.all([
    db.select({ v: count(), listed: sql<number>`count(*) filter (where ${playerProfile.showOnLeaderboard})::int` }).from(playerProfile),
    db.select({ v: sum(xpLedger.amount) }).from(xpLedger),
    db.select({ v: count() }).from(questCompletion),
    db.select({ v: count() }).from(habitCompletion),
    db
      .select({ v: count(), seconds: sum(focusSession.creditedSeconds) })
      .from(focusSession)
      .where(eq(focusSession.status, "completed")),
    db.select({ v: count() }).from(goal).where(isNotNull(goal.completedAt)),
    db.select({ v: count() }).from(playerAchievement),
    db.select({ v: count() }).from(playerSkill),
  ]);

  // ── 30-day trends ─────────────────────────────────────────────────────────
  const signupDay = dayOf(user.createdAt);
  const signups = await db
    .select({ date: signupDay, signups: count() })
    .from(user)
    .where(gte(user.createdAt, trendStart))
    .groupBy(sql`1`);
  const activeDay = dayOf(xpLedger.createdAt);
  const activeRows = await db
    .select({ date: activeDay, active: countDistinct(xpLedger.userId) })
    .from(xpLedger)
    .where(gte(xpLedger.createdAt, trendStart))
    .groupBy(sql`1`);
  const completionDay = dayOf(questCompletion.completedAt);
  const completions = await db
    .select({ date: completionDay, completions: count() })
    .from(questCompletion)
    .where(gte(questCompletion.completedAt, trendStart))
    .groupBy(sql`1`);

  // ── Retention: of accounts at least N days old, how many earned XP N or more days after joining ──
  const retention = await Promise.all(
    [1, 7, 30].map(async (day) => {
      const [row] = await db
        .select({
          eligible: count(),
          // Written out in full: Drizzle drops the table from columns in a single-table select,
          // which would make these compare xp_ledger with itself.
          returned: sql<number>`count(*) filter (where exists (
            select 1 from "xp_ledger"
            where "xp_ledger"."user_id" = "user"."id"
              and "xp_ledger"."created_at" >= "user"."created_at" + make_interval(days => ${day}::int)
          ))::int`,
        })
        .from(user)
        .where(lte(user.createdAt, ago(day)));
      return { day, eligible: n(row?.eligible), returned: n(row?.returned) };
    }),
  );

  // ── Distributions ─────────────────────────────────────────────────────────
  const ranks = await db
    .select({ key: playerProgress.rank, value: count() })
    .from(playerProgress)
    .groupBy(playerProgress.rank);
  const [levels] = await db
    .select({
      average: sql<number>`coalesce(round(avg(${playerProgress.level}), 1), 0)::float`,
      highest: sql<number>`coalesce(max(${playerProgress.level}), 0)::int`,
    })
    .from(playerProgress);
  const focusAreaName = sql<string>`unnest(${playerProfile.focusAreas})::text`;
  const focusAreas = await db.select({ key: focusAreaName, value: count() }).from(playerProfile).groupBy(sql`1`);
  const categories = await db
    .select({ key: playerQuest.category, value: count() })
    .from(questCompletion)
    .innerJoin(playerQuest, eq(playerQuest.id, questCompletion.playerQuestId))
    .groupBy(playerQuest.category);
  const ageGroups = await db.select({ key: user.ageGroup, value: count() }).from(user).groupBy(user.ageGroup);
  const popularAchievements = await db
    .select({ key: achievement.name, value: count() })
    .from(playerAchievement)
    .innerJoin(achievement, eq(achievement.code, playerAchievement.achievementCode))
    .groupBy(achievement.name)
    .orderBy(desc(count()))
    .limit(5);

  // ── Security ──────────────────────────────────────────────────────────────
  const [[lockedNow], [lockouts]] = await Promise.all([
    db.select({ v: count() }).from(authLockout).where(gt(authLockout.lockedUntil, now)),
    db
      .select({ v: count() })
      .from(authLockout)
      .where(and(gt(authLockout.level, 0), gte(authLockout.lastAttemptAt, ago(30)))),
  ]);

  const byValue = (rows: { key: string | null; value: number }[]) =>
    rows.map((r) => ({ key: r.key, value: n(r.value) })).sort((a, b) => b.value - a.value);

  return {
    generatedAt: now,
    accounts: { total: totalAccounts, new7, new30, onboarded: n(players?.v), listedOnLeaderboard: n(players?.listed) },
    active: { day: active1, week: active7, month: active30 },
    totals: {
      xp: n(xp?.v),
      quests: n(quests?.v),
      habitCheckIns: n(habits?.v),
      focusSessions: n(focus?.v),
      focusHours: Math.round(n(focus?.seconds) / 360) / 10,
      goals: n(goals?.v),
      achievements: n(achievements?.v),
      skills: n(skills?.v),
    },
    trends: {
      signups: fillDaily(days, signups, ["signups"] as const),
      active: fillDaily(days, activeRows, ["active"] as const),
      completions: fillDaily(days, completions, ["completions"] as const),
    },
    retention,
    levels: { average: n(levels?.average), highest: n(levels?.highest) },
    distributions: {
      ranks: byValue(ranks),
      focusAreas: byValue(focusAreas),
      categories: byValue(categories),
      ageGroups: byValue(ageGroups),
      achievements: byValue(popularAchievements),
    },
    security: { lockedNow: n(lockedNow?.v), lockouts30d: n(lockouts?.v) },
  };
}
