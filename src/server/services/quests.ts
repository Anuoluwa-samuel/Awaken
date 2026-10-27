import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { playerProfile, playerQuest, playerQuestSchedule, questTemplate } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { resolveQuestXp } from "@/lib/progression/rewards";
import { dayOfWeek, questDay, questDayBounds, type QuestDate } from "@/lib/time";

/**
 * Idempotently prepares today's daily quests for a player (docs/ARCHITECTURE.md §6):
 * expires unfinished dailies from earlier days, then inserts today's set.
 * Safe to call on every request and concurrently — the unique index on
 * (user_id, template_id, quest_date) prevents duplicates.
 */
export async function ensureDailyQuests(db: AppDb, userId: string, now = new Date()): Promise<QuestDate> {
  return db.transaction(async (tx) => {
    const profile = await tx.query.playerProfile.findFirst({
      where: eq(playerProfile.userId, userId),
      columns: { timeZone: true, dayStartHour: true },
    });
    if (!profile) throw new Error("Player profile not found");

    const today = questDay(now, profile.timeZone, profile.dayStartHour);
    const { end } = questDayBounds(today, profile.timeZone, profile.dayStartHour);

    await tx
      .update(playerQuest)
      .set({ status: "expired" })
      .where(
        and(
          eq(playerQuest.userId, userId),
          eq(playerQuest.kind, "daily"),
          lt(playerQuest.questDate, today),
          inArray(playerQuest.status, ["available", "in_progress"]),
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
            kind: "daily" as const,
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
