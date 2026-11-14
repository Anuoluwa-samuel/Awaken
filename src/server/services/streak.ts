import { and, eq, gte, sql } from "drizzle-orm";
import { questCompletion } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { dayStreak, type StreakState } from "@/lib/progression/bonuses";
import { addDays, type QuestDate } from "@/lib/time";

export type PlayerClock = { today: QuestDate; timeZone: string; dayStartHour: number };

/** A completion's quest day, computed in the player's zone from when it actually happened. */
export const completionDay = (clock: Pick<PlayerClock, "timeZone" | "dayStartHour">) =>
  sql<string>`((${questCompletion.completedAt} at time zone ${clock.timeZone}) - make_interval(hours => ${clock.dayStartHour}))::date::text`;

/** Quest days with at least one completion, over the last ~400 days. */
export async function activeQuestDays(db: AppDb, userId: string, clock: PlayerClock): Promise<QuestDate[]> {
  const day = completionDay(clock);
  const rows = await db
    .selectDistinct({ date: day })
    .from(questCompletion)
    .where(and(eq(questCompletion.userId, userId), gte(day, addDays(clock.today, -400))));
  return rows.map((r) => r.date);
}

/** The player's day streak, with this week's streak freeze applied. */
export async function getDayStreak(db: AppDb, userId: string, clock: PlayerClock): Promise<StreakState> {
  return dayStreak(await activeQuestDays(db, userId, clock), clock.today);
}
