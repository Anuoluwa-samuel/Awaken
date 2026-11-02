import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import { playerProfile, playerProgress } from "@/db/schema";
import type { AppDb } from "@/db/types";

export const LEADERBOARD_SIZE = 100;

export type LeaderboardRow = {
  place: number;
  userId: string;
  displayName: string;
  title: string | null;
  level: number;
  rank: (typeof playerProgress.$inferSelect)["rank"];
  totalXp: number;
};

// Only players who are onboarded, opted in and have earned something are ranked.
const ranked = and(eq(playerProfile.showOnLeaderboard, true), gt(playerProgress.totalXp, 0));

/**
 * The global ranking by lifetime XP. Players on equal XP share a place. Returns only what other
 * players may see: never an email. `viewer` is the viewer's own row, also when outside the top
 * list, or null if they're hidden or haven't earned XP yet.
 */
export async function getLeaderboard(db: AppDb, viewerId: string, limit = LEADERBOARD_SIZE) {
  const columns = {
    userId: playerProgress.userId,
    displayName: playerProfile.displayName,
    title: playerProfile.equippedTitle,
    level: playerProgress.level,
    rank: playerProgress.rank,
    totalXp: playerProgress.totalXp,
  };

  const top = await db
    .select({ ...columns, place: sql<number>`(rank() over (order by ${playerProgress.totalXp} desc))::int` })
    .from(playerProgress)
    .innerJoin(playerProfile, eq(playerProfile.userId, playerProgress.userId))
    .where(ranked)
    .orderBy(desc(playerProgress.totalXp), playerProgress.userId)
    .limit(limit);

  const [{ total }] = await db
    .select({ total: count() })
    .from(playerProgress)
    .innerJoin(playerProfile, eq(playerProfile.userId, playerProgress.userId))
    .where(ranked);

  let viewer: LeaderboardRow | null = top.find((row) => row.userId === viewerId) ?? null;
  if (!viewer) {
    const [own] = await db
      .select(columns)
      .from(playerProgress)
      .innerJoin(playerProfile, eq(playerProfile.userId, playerProgress.userId))
      .where(and(eq(playerProgress.userId, viewerId), ranked));
    if (own) {
      const [{ ahead }] = await db
        .select({ ahead: count() })
        .from(playerProgress)
        .innerJoin(playerProfile, eq(playerProfile.userId, playerProgress.userId))
        .where(and(ranked, gt(playerProgress.totalXp, own.totalXp)));
      viewer = { ...own, place: ahead + 1 };
    }
  }

  return { rows: top satisfies LeaderboardRow[], total, viewer };
}
