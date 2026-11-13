import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  achievement,
  levelEvent,
  notification,
  playerAchievement,
  questCompletion,
  playerAttribute,
  playerProgress,
  playerQuest,
  xpLedger,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { ATTRIBUTES, type RankId } from "@/lib/progression/config";
import { levelProgress, rankProgress } from "@/lib/progression/levels";
import type { QuestDate } from "@/lib/time";
import { getDayStreak } from "./streak";

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
    skillPoints: Math.max(0, (progress?.skillPointsEarned ?? 0) - (progress?.skillPointsSpent ?? 0)),
    unreadNotifications: unread[0]?.n ?? 0,
  };
}

export async function getStatusWindow(
  db: AppDb,
  userId: string,
  clock: { today: QuestDate; timeZone: string; dayStartHour: number },
) {
  const { today } = clock;
  const [attributes, todayQuests, streak, recentAchievements] = await Promise.all([
    db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) }),
    db.query.playerQuest.findMany({
      where: and(eq(playerQuest.userId, userId), eq(playerQuest.questDate, today), isNotNull(playerQuest.templateId)),
      orderBy: (q, { asc }) => [asc(q.createdAt)],
    }),
    getDayStreak(db, userId, clock),
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
    streak: streak.current,
    /** This week's streak freeze is still unused. */
    freezeAvailable: streak.freezeAvailable,
    recentAchievements,
  };
}

export type ActivityItem =
  | {
      kind: "xp";
      id: string;
      at: Date;
      eventType: (typeof xpLedger.$inferSelect)["eventType"];
      reason: string;
      amount: number;
    }
  | { kind: "level"; id: string; at: Date; fromLevel: number; toLevel: number; fromRank: RankId; toRank: RankId };

/** XP grants and level/rank events, newest first, from the persisted ledgers only. */
export async function getRecentActivity(db: AppDb, userId: string, limit = 8): Promise<ActivityItem[]> {
  const [xp, levels] = await Promise.all([
    db.query.xpLedger.findMany({
      where: eq(xpLedger.userId, userId),
      orderBy: [desc(xpLedger.createdAt)],
      limit,
    }),
    db.query.levelEvent.findMany({
      where: eq(levelEvent.userId, userId),
      orderBy: [desc(levelEvent.createdAt)],
      limit,
    }),
  ]);
  // Rewards granted in one transaction share a timestamp; within a tie, follow-on rewards
  // (weekly, achievements…) happened after the quest that triggered them.
  const xpItems = xp
    .map((e) => ({
      kind: "xp" as const,
      id: e.id,
      at: e.createdAt,
      eventType: e.eventType,
      reason: e.reason,
      amount: e.amount,
    }))
    .sort(
      (a, b) =>
        b.at.getTime() - a.at.getTime() ||
        Number(a.eventType === "quest_completed") - Number(b.eventType === "quest_completed"),
    );
  const levelItem = (l: (typeof levels)[number]): ActivityItem => ({
    kind: "level",
    id: l.id,
    at: l.createdAt,
    fromLevel: l.fromLevel,
    toLevel: l.toLevel,
    fromRank: l.fromRank,
    toRank: l.toRank,
  });

  // Each level event sits directly above the grant that caused it.
  const byLedger = new Map(levels.map((l) => [l.ledgerId, l]));
  const placed = new Set<string>();
  const items: ActivityItem[] = [];
  for (const item of xpItems) {
    const level = byLedger.get(item.id);
    if (level) {
      items.push(levelItem(level));
      placed.add(level.id);
    }
    items.push(item);
  }
  // Level events whose grant fell outside the window: merge by time.
  for (const l of levels) {
    if (placed.has(l.id)) continue;
    const i = items.findIndex((it) => it.at.getTime() < l.createdAt.getTime());
    items.splice(i === -1 ? items.length : i, 0, levelItem(l));
  }
  return items.slice(0, limit);
}

/** Full level / rank history plus lifetime counters for the profile page. */
export async function getProgressionHistory(db: AppDb, userId: string, limit = 100) {
  const [levels, [{ completions }], [{ earned }]] = await Promise.all([
    db.query.levelEvent.findMany({
      where: eq(levelEvent.userId, userId),
      orderBy: [desc(levelEvent.createdAt)],
      limit,
    }),
    db.select({ completions: count() }).from(questCompletion).where(eq(questCompletion.userId, userId)),
    db
      .select({ earned: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
      .from(xpLedger)
      .where(eq(xpLedger.userId, userId)),
  ]);
  return {
    levels,
    rankUps: levels.filter((l) => l.fromRank !== l.toRank),
    questsCompleted: completions,
    ledgerXp: earned,
  };
}
