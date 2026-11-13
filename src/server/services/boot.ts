import { and, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { playerProfile, playerQuest, xpLedger } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { addDays, questDayBounds } from "@/lib/time";
import type { PlayerClock } from "./streak";

export type BootSummary = {
  today: string;
  /** The player's first quest day: the welcome message covers it, so there's no boot screen. */
  firstDay: boolean;
  yesterdayXp: number;
  questsToday: number;
  /** Title of today's surprise System event quest, if there is one. */
  eventTitle: string | null;
};

/** What the daily "System boot" screen reports: yesterday's haul and today's orders. */
export async function getBootSummary(db: AppDb, userId: string, clock: PlayerClock): Promise<BootSummary> {
  const { start, end } = questDayBounds(addDays(clock.today, -1), clock.timeZone, clock.dayStartHour);
  const [[xp], quests, profile] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${xpLedger.amount}), 0)::int` })
      .from(xpLedger)
      .where(and(eq(xpLedger.userId, userId), gte(xpLedger.createdAt, start), lt(xpLedger.createdAt, end))),
    db
      .select({ title: playerQuest.title, isEvent: playerQuest.isEvent })
      .from(playerQuest)
      .where(and(eq(playerQuest.userId, userId), eq(playerQuest.questDate, clock.today), isNotNull(playerQuest.templateId))),
    db.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId), columns: { createdAt: true } }),
  ]);
  return {
    today: clock.today,
    firstDay: !profile || profile.createdAt >= questDayBounds(clock.today, clock.timeZone, clock.dayStartHour).start,
    yesterdayXp: Math.max(0, xp?.total ?? 0),
    questsToday: quests.length,
    eventTitle: quests.find((q) => q.isEvent)?.title ?? null,
  };
}
