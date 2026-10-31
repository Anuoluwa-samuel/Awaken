import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditEvent, authLockout, playerQuest, user, verification } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { purgeAccountExtras } from "@/server/services/account";
import { recordFailure, reserveAttempt } from "@/server/services/lockout";
import { createPlayer } from "@/server/services/player";
import { completeQuest } from "@/server/services/quests";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const NOW = new Date("2026-10-31T10:00:00Z");

/** A player with real activity in most tables: profile, quests, a completion, XP, achievements … */
async function activePlayer() {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    {
      displayName: "Jin",
      timeZone: "Africa/Lagos",
      dayStartHour: 4,
      focusAreas: ["learning", "fitness"],
      preferredDifficulty: "normal",
      dailyTarget: null,
    },
    NOW,
  );
  const [quest] = await db.select().from(playerQuest).where(eq(playerQuest.userId, userId)).limit(1);
  await completeQuest(db, userId, quest!.id, { now: NOW });
  const email = `${userId}@example.test`;
  await db.insert(auditEvent).values({ actorUserId: userId, action: "test", targetType: "player_profile", targetId: userId });
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: "reset-password:abc",
    value: userId,
    expiresAt: new Date(NOW.getTime() + 60_000),
  });
  await reserveAttempt(db, email, NOW);
  await recordFailure(db, email, NOW);
  return { userId, email };
}

/** Every row anywhere that still points at the player, across all tables with a user column. */
async function remainingRows(userId: string) {
  const { rows } = (await db.execute(sql`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and column_name in ('user_id', 'actor_user_id')`)) as unknown as {
    rows: { table_name: string; column_name: string }[];
  };
  const counts: Record<string, number> = {};
  for (const { table_name, column_name } of rows) {
    const result = (await db.execute(
      sql`select count(*)::int as n from ${sql.identifier(table_name)} where ${sql.identifier(column_name)} = ${userId}`,
    )) as unknown as { rows: { n: number }[] };
    if (result.rows[0]!.n > 0) counts[table_name] = result.rows[0]!.n;
  }
  return { tablesChecked: rows.length, counts };
}

describe("account deletion", () => {
  it("removes every row linked to the player and leaves other players alone", async () => {
    const target = await activePlayer();
    const bystander = await activePlayer();
    expect(Object.keys((await remainingRows(target.userId)).counts).length).toBeGreaterThan(5);

    // What Better Auth's delete-user endpoint does: our beforeDelete hook, then the user row.
    await purgeAccountExtras(db, target.userId, target.email);
    await db.delete(user).where(eq(user.id, target.userId));

    const after = await remainingRows(target.userId);
    expect(after.tablesChecked).toBeGreaterThan(15);
    expect(after.counts).toEqual({});
    expect(await db.select().from(verification).where(eq(verification.value, target.userId))).toEqual([]);
    expect(await db.select().from(authLockout).where(eq(authLockout.email, target.email))).toEqual([]);

    const untouched = await remainingRows(bystander.userId);
    expect(Object.keys(untouched.counts).length).toBeGreaterThan(5);
    expect(await db.select().from(authLockout).where(eq(authLockout.email, bystander.email))).toHaveLength(1);
  });
});
