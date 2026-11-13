import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { addDays } from "@/lib/time";
import { evaluateAchievements } from "./services/achievements";
import { ensureDeadlineNotifications, notify } from "./services/notifications";
import { hadActivity } from "./services/report";
import { ensureDailyQuests } from "./services/quests";
import { ensureWeeklyChallenges } from "./services/weekly";

/**
 * Authenticated player + today's quest day for this request.
 * Also lazily rolls the player's quests and weekly challenges over to the current day/week.
 */
export const getPlayerContext = cache(async () => {
  const { user, profile } = await requirePlayer();
  const now = new Date();
  const today = await ensureDailyQuests(db, user.id, now);
  const week = await ensureWeeklyChallenges(db, user.id, now);
  // Catch up on achievements earned before they existed or outside a reward flow (idempotent).
  await db.transaction((tx) => evaluateAchievements(tx, user.id, now));
  await ensureDeadlineNotifications(db, user.id, today, now);
  // Each new week, announce last week's report, if there was anything in it.
  const lastWeek = addDays(week, -7);
  const clock = { today, timeZone: profile.timeZone, dayStartHour: profile.dayStartHour };
  if (await hadActivity(db, user.id, clock, lastWeek)) {
    await notify(db, {
      userId: user.id,
      type: "system",
      title: "Your weekly report is ready",
      body: `See how the week of ${lastWeek} went, and what to focus on next.`,
      href: "/system/report",
      dedupeKey: `report:${user.id}:${lastWeek}`,
      createdAt: now,
    });
  }
  return { user, profile, today, week };
});
