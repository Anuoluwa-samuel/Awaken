import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { playerAttribute, playerProgress, playerQuest } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { createPlayer, pickStarterTemplateKeys } from "@/server/services/player";
import { ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const input = {
  displayName: "Jin",
  timeZone: "Africa/Lagos",
  dayStartHour: 4,
  focusAreas: ["learning", "fitness"] as ("learning" | "fitness")[],
  preferredDifficulty: "normal" as const,
  dailyTarget: null,
};

describe("createPlayer", () => {
  it("creates progression, attributes and starter quests", async () => {
    const userId = await createUser(db);
    const now = new Date("2026-10-27T10:00:00Z");
    expect((await createPlayer(db, userId, input, now)).created).toBe(true);

    const progress = await db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
    expect(progress).toMatchObject({ totalXp: 0, level: 1, rank: "E" });

    const attrs = await db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) });
    expect(attrs).toHaveLength(5);

    const quests = await listQuestsForDay(db, userId, "2026-10-27");
    expect(quests.map((q) => q.title)).toEqual(
      expect.arrayContaining(["Review your daily priorities", "Read or study for 30 minutes", "Complete a workout"]),
    );
    expect(quests.every((q) => q.status === "available" && q.kind === "daily")).toBe(true);
    // Reward snapshotted from difficulty defaults.
    expect(quests.find((q) => q.difficulty === "normal")?.xpReward).toBe(25);
  });

  it("is idempotent", async () => {
    const userId = await createUser(db);
    const now = new Date("2026-10-27T10:00:00Z");
    await createPlayer(db, userId, input, now);
    expect((await createPlayer(db, userId, { ...input, displayName: "Other" }, now)).created).toBe(false);
    expect(await listQuestsForDay(db, userId, "2026-10-27")).toHaveLength(
      pickStarterTemplateKeys(input.focusAreas, null).length,
    );
  });
});

describe("ensureDailyQuests", () => {
  it("never duplicates a day's quests, even when called concurrently", async () => {
    const userId = await createUser(db);
    const now = new Date("2026-10-27T10:00:00Z");
    await createPlayer(db, userId, input, now);
    await Promise.all(Array.from({ length: 5 }, () => ensureDailyQuests(db, userId, now)));
    const quests = await listQuestsForDay(db, userId, "2026-10-27");
    expect(new Set(quests.map((q) => q.templateId)).size).toBe(quests.length);
  });

  it("rolls over at the player's day start and expires unfinished quests", async () => {
    const userId = await createUser(db);
    // 02:59 Lagos time on the 28th is still the 27th's quest day (start hour 4).
    await createPlayer(db, userId, input, new Date("2026-10-27T10:00:00Z"));
    expect(await ensureDailyQuests(db, userId, new Date("2026-10-28T01:59:00Z"))).toBe("2026-10-27");

    expect(await ensureDailyQuests(db, userId, new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
    const old = await db.query.playerQuest.findMany({
      where: and(eq(playerQuest.userId, userId), eq(playerQuest.questDate, "2026-10-27")),
    });
    expect(old.every((q) => q.status === "expired")).toBe(true);
    // Day one is the starter set; from day two, the day's own rotating mix.
    const next = await listQuestsForDay(db, userId, "2026-10-28");
    expect(next.length).toBe(5);
    const yesterday = new Set(old.map((q) => q.templateId));
    expect(next.filter((q) => yesterday.has(q.templateId))).toEqual([]);
  });

  it("keeps players' quests isolated", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const now = new Date("2026-10-27T10:00:00Z");
    await createPlayer(db, a, input, now);
    await createPlayer(db, b, { ...input, focusAreas: [] }, now);
    const aQuests = await listQuestsForDay(db, a, "2026-10-27");
    expect(aQuests.every((q) => q.userId === a)).toBe(true);
  });
});

describe("pickStarterTemplateKeys", () => {
  it("falls back to defaults and respects the daily target", () => {
    expect(pickStarterTemplateKeys([], null)).toHaveLength(3);
    expect(pickStarterTemplateKeys(["learning", "career", "creativity", "fitness", "finance"], 2)).toHaveLength(2);
    expect(pickStarterTemplateKeys(["learning"], null)[0]).toBe("daily.review-priorities");
  });
});
