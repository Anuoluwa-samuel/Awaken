import { and, count, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  achievement,
  notification,
  playerAchievement,
  questCompletion,
  playerAttribute,
  playerProgress,
  playerQuest,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { ATTRIBUTES } from "@/lib/progression/config";
import { levelProgress, rankProgress } from "@/lib/progression/levels";
import { activeDayStreak } from "@/lib/progression/streaks";
import { addDays, type QuestDate } from "@/lib/time";

/** Compact numbers for the persistent shell (sidebar / top bar). */
export async function getShellSummary(db: AppDb, userId: string, today: QuestDate) {
  const [progress, quests, openOneOff, unread] = await Promise.all([
    db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) }),
    db
      .select({ status: playerQuest.status, n: count() })
      .from(playerQuest)
      .where(
        and(eq(playerQuest.userId, userId), eq(playerQuest.questDate, today), isNotNull(playerQuest.templateId)),
      )
      .groupBy(playerQuest.status),
    db
      .select({ n: count() })
      .from(playerQuest)
      .where(
        and(
          eq(playerQuest.userId, userId),
          isNull(playerQuest.templateId),
          inArray(playerQuest.status, ["available", "in_progress"]),
        ),
      ),
    db
      .select({ n: count() })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt))),
  ]);
  const totalXp = progress?.totalXp ?? 0;
  const byStatus = Object.fromEntries(quests.map((q) => [q.status, q.n]));
  const open = (byStatus.available ?? 0) + (byStatus.in_progress ?? 0);
  return {
    level: levelProgress(totalXp),
    rank: rankProgress(totalXp),
    /** Open scheduled quests today plus open one-off custom quests. */
    questsOpen: open + (openOneOff[0]?.n ?? 0),
    questsDone: byStatus.completed ?? 0,
    questsTotal: open + (byStatus.completed ?? 0),
    unreadNotifications: unread[0]?.n ?? 0,
  };
}

export async function getStatusWindow(
  db: AppDb,
  userId: string,
  clock: { today: QuestDate; timeZone: string; dayStartHour: number },
) {
  const { today } = clock;
  const since = addDays(today, -400);
  // A completion's quest day, computed in the player's zone from when it actually happened.
  const completionDay = sql<string>`((${questCompletion.completedAt} at time zone ${clock.timeZone}) - make_interval(hours => ${clock.dayStartHour}))::date::text`;
  const [attributes, todayQuests, activeDates, recentXp, recentAchievements] = await Promise.all([
    db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) }),
    db.query.playerQuest.findMany({
      where: and(eq(playerQuest.userId, userId), eq(playerQuest.questDate, today), isNotNull(playerQuest.templateId)),
      orderBy: (q, { asc }) => [asc(q.createdAt)],
    }),
    db
      .selectDistinct({ date: completionDay })
      .from(questCompletion)
      .where(and(eq(questCompletion.userId, userId), gte(completionDay, since))),
    db.query.xpLedger.findMany({
      where: eq(xpLedger.userId, userId),
      orderBy: [desc(xpLedger.createdAt)],
      limit: 6,
    }),
    db
      .select({
        code: achievement.code,
        name: achievement.name,
        icon: achievement.icon,
        unlockedAt: playerAchievement.unlockedAt,
      })
      .from(playerAchievement)
      .innerJoin(achievement, eq(achievement.code, playerAchievement.achievementCode))
      .where(eq(playerAchievement.userId, userId))
      .orderBy(desc(playerAchievement.unlockedAt))
      .limit(3),
  ]);

  const points = Object.fromEntries(attributes.map((a) => [a.attribute, a.points]));
  return {
    attributes: ATTRIBUTES.map((a) => ({ attribute: a, points: points[a] ?? 0 })),
    todayQuests,
    streak: activeDayStreak(activeDates.map((d) => d.date), today),
    recentXp,
    recentAchievements,
  };
}
