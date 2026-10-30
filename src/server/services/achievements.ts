import { and, asc, count, eq, gte, isNull } from "drizzle-orm";
import {
  achievement,
  habit,
  habitCompletion,
  playerAchievement,
  playerProfile,
  playerProgress,
  playerQuest,
  playerSkill,
  playerTitle,
  questCompletion,
  weeklyChallenge,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { criteriaProgress, meetsCriteria, type PlayerMetrics } from "@/lib/progression/achievements";
import type { Category } from "@/lib/progression/config";
import { habitStats, scheduleOf } from "@/lib/progression/habits";
import { addDays, questDay, type QuestDate } from "@/lib/time";
import { notify } from "./notifications";
import { grantXp, lockProgress } from "./rewards";

// Achievement engine — docs/ARCHITECTURE.md §6d.
// Criteria are evaluated against persisted records only. Each unlock is guarded by the
// player_achievement primary key and its XP by the ledger key `achievement:{user}:{code}`,
// so re-evaluating (on every reward, page load, retry) never grants twice.

export class AchievementError extends Error {
  constructor(
    readonly code: "TITLE_NOT_OWNED" | "PLAYER_NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export type UnlockedAchievement = {
  code: string;
  name: string;
  icon: string;
  xpReward: number;
  titleReward: string | null;
};

async function playerToday(db: AppDb, userId: string, now: Date): Promise<QuestDate> {
  const profile = await db.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { timeZone: true, dayStartHour: true },
  });
  if (!profile) throw new AchievementError("PLAYER_NOT_FOUND", "Player profile not found");
  return questDay(now, profile.timeZone, profile.dayStartHour);
}

export async function computeMetrics(db: AppDb, userId: string, today: QuestDate): Promise<PlayerMetrics> {
  const [progress, [{ quests }], byCategory, [{ weekly }], [{ checkIns }], [{ skills }], habits] = await Promise.all([
    db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId), columns: { level: true } }),
    db.select({ quests: count() }).from(questCompletion).where(eq(questCompletion.userId, userId)),
    db
      .select({ category: playerQuest.category, n: count() })
      .from(questCompletion)
      .innerJoin(playerQuest, eq(playerQuest.id, questCompletion.playerQuestId))
      .where(eq(questCompletion.userId, userId))
      .groupBy(playerQuest.category),
    db
      .select({ weekly: count() })
      .from(weeklyChallenge)
      .where(and(eq(weeklyChallenge.userId, userId), eq(weeklyChallenge.status, "completed"))),
    db.select({ checkIns: count() }).from(habitCompletion).where(eq(habitCompletion.userId, userId)),
    db.select({ skills: count() }).from(playerSkill).where(eq(playerSkill.userId, userId)),
    db.query.habit.findMany({
      where: and(eq(habit.userId, userId), isNull(habit.archivedAt)),
      columns: { id: true, scheduleDays: true, timesPerWeek: true, startDate: true },
    }),
  ]);

  // Best current day-streak across day-scheduled habits (weekly habits count weeks, not days).
  let bestHabitStreak = 0;
  const dayHabits = habits.filter((h) => !h.timesPerWeek);
  if (dayHabits.length) {
    const rows = await db
      .select({ habitId: habitCompletion.habitId, date: habitCompletion.localDate })
      .from(habitCompletion)
      .where(and(eq(habitCompletion.userId, userId), gte(habitCompletion.localDate, addDays(today, -400))));
    for (const h of dayHabits) {
      const dates = rows.filter((r) => r.habitId === h.id).map((r) => r.date);
      bestHabitStreak = Math.max(bestHabitStreak, habitStats(scheduleOf(h), dates, h.startDate, today).current);
    }
  }

  return {
    questsCompleted: quests,
    level: progress?.level ?? 1,
    categoryQuests: Object.fromEntries(byCategory.map((r) => [r.category, r.n])) as Partial<Record<Category, number>>,
    weeklyCompleted: weekly,
    bestHabitStreak,
    habitCheckIns: checkIns,
    skillsUnlocked: skills,
  };
}

/**
 * Unlocks every achievement the player now qualifies for, granting XP, titles and a
 * notification once each. Repeats until stable, since an achievement's XP can level the
 * player up into another one. Call inside the transaction that changed the records.
 */
export async function evaluateAchievements(tx: AppDb, userId: string, now = new Date()): Promise<UnlockedAchievement[]> {
  await lockProgress(tx, userId);
  const today = await playerToday(tx, userId, now);
  const all = await tx.query.achievement.findMany({ orderBy: [asc(achievement.code)] });
  const unlocked: UnlockedAchievement[] = [];

  for (let pass = 0; pass < 5; pass++) {
    const [metrics, owned] = await Promise.all([
      computeMetrics(tx, userId, today),
      tx.select({ code: playerAchievement.achievementCode }).from(playerAchievement).where(eq(playerAchievement.userId, userId)),
    ]);
    const ownedCodes = new Set(owned.map((o) => o.code));
    const due = all.filter((a) => !ownedCodes.has(a.code) && meetsCriteria(a.criteria, metrics));
    if (due.length === 0) break;

    for (const a of due) {
      const [row] = await tx
        .insert(playerAchievement)
        .values({ userId, achievementCode: a.code, unlockedAt: now })
        .onConflictDoNothing()
        .returning({ code: playerAchievement.achievementCode });
      if (!row) continue;

      if (a.xpReward > 0) {
        await grantXp(tx, {
          userId,
          eventType: "achievement_unlocked",
          sourceType: "achievement",
          sourceId: a.code,
          amount: a.xpReward,
          reason: `Achievement: ${a.name}`,
          idempotencyKey: `achievement:${userId}:${a.code}`,
          now,
        });
      }
      if (a.titleReward) {
        await tx
          .insert(playerTitle)
          .values({ userId, title: a.titleReward, source: `achievement:${a.code}`, earnedAt: now })
          .onConflictDoNothing();
      }
      await notify(tx, {
        userId,
        type: "achievement",
        title: "New achievement unlocked",
        body: [a.name, a.xpReward ? `+${a.xpReward} XP` : null, a.titleReward ? `Title: ${a.titleReward}` : null]
          .filter(Boolean)
          .join(" · "),
        href: "/system/achievements",
        dedupeKey: `achievement:${userId}:${a.code}`,
        createdAt: now,
      });
      unlocked.push({ code: a.code, name: a.name, icon: a.icon, xpReward: a.xpReward, titleReward: a.titleReward });
    }
  }
  return unlocked;
}

/** All achievements with unlock state and progress, for the achievements page. */
export async function listAchievements(db: AppDb, userId: string, today: QuestDate) {
  const [all, owned, metrics] = await Promise.all([
    db.query.achievement.findMany(),
    db.query.playerAchievement.findMany({ where: eq(playerAchievement.userId, userId) }),
    computeMetrics(db, userId, today),
  ]);
  const unlockedAt = new Map(owned.map((o) => [o.achievementCode, o.unlockedAt]));
  return all
    .map((a) => ({
      ...a,
      unlockedAt: unlockedAt.get(a.code) ?? null,
      progress: criteriaProgress(a.criteria, metrics),
    }))
    .sort(
      (a, b) =>
        Number(!!b.unlockedAt) - Number(!!a.unlockedAt) ||
        (b.unlockedAt?.getTime() ?? 0) - (a.unlockedAt?.getTime() ?? 0) ||
        b.progress.ratio - a.progress.ratio,
    );
}

export async function listTitles(db: AppDb, userId: string) {
  return db.query.playerTitle.findMany({
    where: eq(playerTitle.userId, userId),
    orderBy: [asc(playerTitle.earnedAt)],
  });
}

/**
 * Equips an earned title (or clears it with null). Purely cosmetic: it changes no
 * progression and grants nothing.
 */
export async function equipTitle(db: AppDb, userId: string, title: string | null) {
  if (title !== null) {
    const owned = await db.query.playerTitle.findFirst({
      where: and(eq(playerTitle.userId, userId), eq(playerTitle.title, title)),
    });
    if (!owned) throw new AchievementError("TITLE_NOT_OWNED", "You haven't earned that title.");
  }
  await db.update(playerProfile).set({ equippedTitle: title }).where(eq(playerProfile.userId, userId));
}
