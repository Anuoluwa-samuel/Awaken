import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { playerProfile, user } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { getAdminAnalytics } from "@/server/services/admin-analytics";
import { getLeaderboard } from "@/server/services/leaderboard";
import { createPlayer, updateSettings } from "@/server/services/player";
import { grantXp } from "@/server/services/rewards";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const NOW = new Date("2026-11-02T10:00:00Z");
const settings = {
  displayName: "Player",
  timeZone: "Africa/Lagos",
  dayStartHour: 4,
  focusAreas: ["learning" as const],
  preferredDifficulty: "normal" as const,
  dailyTarget: null,
};

async function player(name: string, xp: number, ageGroup: "adult" | "teen" = "adult") {
  const userId = await createUser(db);
  await db.update(user).set({ ageGroup }).where(eq(user.id, userId));
  await createPlayer(db, userId, { ...settings, displayName: name }, NOW);
  if (xp > 0) {
    await db.transaction((tx) =>
      grantXp(tx, { userId, eventType: "quest_completed", sourceType: "test", amount: xp, reason: "test", idempotencyKey: `t:${userId}`, now: NOW }),
    );
  }
  return userId;
}

describe("leaderboard", () => {
  it("ranks by lifetime XP, shares places on ties, and exposes no email", async () => {
    const first = await player("First", 500);
    const tiedA = await player("Tied A", 300);
    const tiedB = await player("Tied B", 300);
    const last = await player("Last", 50);
    const none = await player("No XP yet", 0);

    const { rows, total, viewer } = await getLeaderboard(db, last);
    const place = (id: string) => rows.find((r) => r.userId === id)?.place;
    expect(place(first)).toBe(1);
    expect(place(tiedA)).toBe(2);
    expect(place(tiedB)).toBe(2);
    expect(place(last)).toBe(4);
    expect(total).toBe(4);
    expect(viewer?.place).toBe(4);
    expect(rows.some((r) => r.userId === none)).toBe(false);
    expect(JSON.stringify(rows)).not.toContain("@");
    expect((await getLeaderboard(db, none)).viewer).toBeNull();
  });

  it("finds the viewer's true place when they're outside the list", async () => {
    const viewerId = await player("Far Below", 1);
    const { rows, viewer, total } = await getLeaderboard(db, viewerId, 2);
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.userId === viewerId)).toBe(false);
    expect(viewer?.place).toBe(total);
  });

  it("hides under-18s by default, and lets anyone opt in or out", async () => {
    const teen = await player("Young One", 200, "teen");
    expect((await getLeaderboard(db, teen)).rows.some((r) => r.userId === teen)).toBe(false);
    expect((await getLeaderboard(db, teen)).viewer).toBeNull();

    await updateSettings(db, teen, { ...settings, showOnLeaderboard: true }, NOW);
    expect((await getLeaderboard(db, teen)).viewer?.displayName).toBe("Player");

    await updateSettings(db, teen, { ...settings, showOnLeaderboard: false }, NOW);
    expect((await getLeaderboard(db, teen)).viewer).toBeNull();

    // Saving settings without the field leaves the choice alone.
    await updateSettings(db, teen, settings, NOW);
    const profile = await db.query.playerProfile.findFirst({ where: eq(playerProfile.userId, teen) });
    expect(profile?.showOnLeaderboard).toBe(false);
  });
});

describe("admin analytics", () => {
  it("returns correct aggregates and no individual players' data", async () => {
    const before = await getAdminAnalytics(db, NOW);
    const name = "Unique Analytics Name";
    await player(name, 120);
    const after = await getAdminAnalytics(db, NOW);

    expect(after.accounts.total).toBe(before.accounts.total + 1);
    expect(after.accounts.onboarded).toBe(before.accounts.onboarded + 1);
    expect(after.totals.xp).toBe(before.totals.xp + 120);
    expect(after.active.day).toBe(before.active.day + 1);
    expect(after.trends.active).toHaveLength(30);
    expect(after.trends.active.at(-1)).toEqual({ date: "2026-11-02", active: after.active.day });
    expect(after.distributions.ranks.reduce((sum, r) => sum + r.value, 0)).toBe(after.accounts.onboarded);

    const output = JSON.stringify(after);
    expect(output).not.toContain(name);
    expect(output).not.toContain("@example.test");
  });

  it("counts a player as retained only if they came back after the window", async () => {
    const userId = await createUser(db);
    await db.update(user).set({ createdAt: new Date("2026-10-20T10:00:00Z") }).where(eq(user.id, userId));
    const eligible = (await getAdminAnalytics(db, NOW)).retention.find((r) => r.day === 7)!;
    await createPlayer(db, userId, settings, NOW);
    await db.transaction((tx) =>
      grantXp(tx, { userId, eventType: "quest_completed", sourceType: "test", amount: 10, reason: "t", idempotencyKey: `r:${userId}`, now: NOW }),
    );
    const after = (await getAdminAnalytics(db, NOW)).retention.find((r) => r.day === 7)!;
    expect(after.returned).toBe(eligible.returned + 1);
  });
});
