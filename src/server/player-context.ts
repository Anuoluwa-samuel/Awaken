import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { ensureDailyQuests } from "./services/quests";

/**
 * Authenticated player + today's quest day for this request.
 * Also lazily rolls the player's quests over to the current day.
 */
export const getPlayerContext = cache(async () => {
  const { user, profile } = await requirePlayer();
  const today = await ensureDailyQuests(db, user.id);
  return { user, profile, today };
});
