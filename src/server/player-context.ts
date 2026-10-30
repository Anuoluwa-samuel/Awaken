import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { evaluateAchievements } from "./services/achievements";
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
  return { user, profile, today, week };
});
