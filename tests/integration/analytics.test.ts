import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/db/types";
import { getAnalytics } from "@/server/services/analytics";
import { completeFocus, startFocus } from "@/server/services/focus";
import { checkInHabit, createHabit } from "@/server/services/habits";
import { createPlayer } from "@/server/services/player";
import { completeQuest, ensureDailyQuests, listQuestsForDay } from "@/server/services/quests";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const tz = { timeZone: "Africa/Lagos", dayStartHour: 4 };
const at = (iso: string) => new Date(iso);

async function newPlayer() {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    { displayName: "P", ...tz, focusAreas: ["learning"], preferredDifficulty: "normal", dailyTarget: null },
    at("2026-10-25T10:00:00Z"),
  );
  return userId;
}

describe("getAnalytics", () => {
  it("buckets by the player's quest day and fills empty days", async () => {
    const userId = await newPlayer();
    // 26th: complete at 02:30 UTC on the 27th = 03:30 Lagos → still the 26th's quest day.
    await ensureDailyQuests(db, userId, at("2026-10-26T10:00:00Z"));
    const [q26] = await listQuestsForDay(db, userId, "2026-10-26");
    await completeQuest(db, userId, q26.id, { now: at("2026-10-27T02:30:00Z") });
    // 27th: visited but nothing done, so its quests expire when the 28th starts.
    // (Days the player never opens the app generate no quests, so they can't count as missed.)
    await ensureDailyQuests(db, userId, at("2026-10-27T10:00:00Z"));
    await ensureDailyQuests(db, userId, at("2026-10-28T10:00:00Z"));

    const a = await getAnalytics(db, userId, { from: "2026-10-25", to: "2026-10-28", today: "2026-10-28", ...tz });
    expect(a.xp.map((d) => d.date)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]);
    // + First Blood, + Night Owl (hidden: completed at 03:30 local).
    expect(a.xp.find((d) => d.date === "2026-10-26")!.xp).toBe(q26.xpReward + 10 + 10);
    expect(a.xp.find((d) => d.date === "2026-10-27")!.xp).toBe(0);
    expect(a.totals.questsCompleted).toBe(1);

    const day27 = a.quests.find((d) => d.date === "2026-10-27")!;
    expect(day27.completed).toBe(0);
    expect(day27.missed).toBeGreaterThan(0);
    // 25th's quests expired too; today's (28th) open quests count as neither.
    expect(a.quests.find((d) => d.date === "2026-10-28")).toMatchObject({ completed: 0, missed: 0 });
    expect(a.totals.scheduledRate).toBeGreaterThan(0);
    expect(a.totals.scheduledRate).toBeLessThan(1);
    expect(a.categories).toEqual([{ category: q26.category, label: expect.any(String), completed: 1 }]);
  });

  it("accumulates attributes from their pre-range baseline", async () => {
    const userId = await newPlayer();
    await ensureDailyQuests(db, userId, at("2026-10-25T10:00:00Z"));
    const [q] = await listQuestsForDay(db, userId, "2026-10-25");
    await completeQuest(db, userId, q.id, { now: at("2026-10-25T11:00:00Z") });
    // Window starts after the gain: the line starts at the earned total, not zero.
    const a = await getAnalytics(db, userId, { from: "2026-10-26", to: "2026-10-27", today: "2026-10-27", ...tz });
    const total = (row: (typeof a.attributes)[number]) => row.strength + row.intelligence + row.discipline + row.vitality + row.creativity;
    expect(total(a.attributes[0])).toBeGreaterThan(0);
    expect(total(a.attributes[0])).toBe(total(a.attributes[1]));
  });

  it("reports focus minutes, habit rates and streaks from records", async () => {
    const userId = await newPlayer();
    const { session } = await startFocus(db, userId, { minutes: 25 }, at("2026-10-26T10:00:00Z"));
    await completeFocus(db, userId, session.id, at("2026-10-26T10:25:00Z"));
    const h = await createHabit(
      db,
      userId,
      { name: "Water", description: "", category: "wellbeing", attribute: null, scheduleType: "days", days: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: null, linkedTemplateId: null },
      at("2026-10-26T10:00:00Z"),
    );
    await checkInHabit(db, userId, h.id, at("2026-10-26T12:00:00Z"));
    await checkInHabit(db, userId, h.id, at("2026-10-28T12:00:00Z"));

    const a = await getAnalytics(db, userId, { from: "2026-10-22", to: "2026-10-28", today: "2026-10-28", ...tz });
    expect(a.totals).toMatchObject({ focusMinutes: 25, focusSessions: 1, habitCheckIns: 2 });
    expect(a.focus.find((d) => d.date === "2026-10-26")).toMatchObject({ minutes: 25, sessions: 1 });
    expect(a.habits[0]).toMatchObject({ name: "Water", done: 2, due: 3, current: 1, longest: 1 });
  });

  it("switches to weekly buckets for long ranges and never leaks other players' data", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await ensureDailyQuests(db, b, at("2026-10-26T10:00:00Z"));
    const [q] = await listQuestsForDay(db, b, "2026-10-26");
    await completeQuest(db, b, q.id, { now: at("2026-10-26T11:00:00Z") });

    const result = await getAnalytics(db, a, { from: "2026-08-01", to: "2026-10-28", today: "2026-10-28", ...tz });
    expect(result.weekly).toBe(true);
    expect(result.xp.length).toBe(Math.ceil(result.days / 7));
    expect(result.totals).toMatchObject({ xp: 0, questsCompleted: 0, habitCheckIns: 0 });
  });
});
