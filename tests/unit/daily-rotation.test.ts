import { describe, expect, it } from "vitest";
import { SYSTEM_QUEST_TEMPLATES } from "@/db/seed-data";
import { pickDailyQuests, type RotationTemplate } from "@/lib/progression/daily-rotation";
import { CATEGORIES, type Category } from "@/lib/progression/config";
import { addDays } from "@/lib/time";

const pool: RotationTemplate[] = SYSTEM_QUEST_TEMPLATES.filter((t) => t.cadence === "daily" && !t.requiredSkill).map((t) => ({
  id: t.key,
  category: t.category,
  difficulty: t.difficulty,
}));
const byId = new Map(pool.map((t) => [t.id, t]));
const START = "2026-11-02";

/** Plays out `days` days for a player, feeding each day's picks back in as history. */
function simulate(days: number, focusAreas: Category[], count = 5, user = "player-1") {
  const lastSeen = new Map<string, string>();
  const history: string[][] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(START, i);
    const picks = pickDailyQuests({ pool, focusAreas, count, seed: `${user}:${date}`, lastSeen });
    picks.forEach((id) => lastSeen.set(id, date));
    history.push(picks);
  }
  return history;
}

describe("the quest pool", () => {
  it("has real variety in every category", () => {
    expect(pool.length).toBeGreaterThanOrEqual(55);
    for (const category of CATEGORIES) {
      expect(pool.filter((t) => t.category === category).length, category).toBeGreaterThanOrEqual(5);
    }
  });

  it("has unique keys, and titles within the limit", () => {
    const keys = SYSTEM_QUEST_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of SYSTEM_QUEST_TEMPLATES) expect(t.title.length).toBeLessThanOrEqual(80);
  });
});

describe("pickDailyQuests", () => {
  it("gives the same answer every time for the same player and day", () => {
    const input = { pool, focusAreas: ["learning"] as Category[], count: 5, seed: "p:2026-11-02", lastSeen: new Map() };
    expect(pickDailyQuests(input)).toEqual(pickDailyQuests(input));
  });

  it("gives different players different mixes", () => {
    expect(simulate(1, [], 5, "a")[0]).not.toEqual(simulate(1, [], 5, "b")[0]);
  });

  it("spreads quests out: nothing comes back within 5 days, and all of the pool gets used", () => {
    const history = simulate(60, []);
    for (let i = 0; i < history.length; i++) {
      const recent = new Set(history.slice(Math.max(0, i - 5), i).flat());
      expect(history[i]!.filter((id) => recent.has(id)), `day ${i}`).toEqual([]);
    }
    expect(new Set(history.flat()).size).toBe(pool.length);
    // Consecutive days never look alike.
    expect(new Set(history.map((day) => [...day].sort().join())).size).toBe(history.length);
  });

  it("doesn't repeat yesterday's quests, even with one focus area", () => {
    const history = simulate(30, ["fitness"]);
    for (let i = 1; i < history.length; i++) {
      const yesterday = new Set(history[i - 1]);
      expect(history[i]!.filter((id) => yesterday.has(id)), `day ${i}`).toEqual([]);
    }
  });

  it("favours the player's focus areas but keeps some variety", () => {
    const counts = { focus: 0, other: 0 };
    for (const day of simulate(20, ["learning", "fitness"])) {
      for (const id of day) counts[["learning", "fitness"].includes(byId.get(id)!.category) ? "focus" : "other"]++;
    }
    expect(counts.focus).toBeGreaterThan(counts.other * 2);
    expect(counts.other).toBeGreaterThan(0);
  });

  it("gives each focus area a turn on every day", () => {
    for (const day of simulate(10, ["career", "finance"])) {
      const categories = new Set(day.map((id) => byId.get(id)!.category));
      expect(categories.has("career") && categories.has("finance")).toBe(true);
    }
  });

  it("keeps each day achievable", () => {
    for (const day of simulate(30, [])) {
      expect(day.filter((id) => ["hard", "elite"].includes(byId.get(id)!.difficulty)).length).toBeLessThanOrEqual(1);
    }
  });

  it("honours the daily target, and copes with a pool that's too small", () => {
    expect(simulate(1, [], 12)[0]).toHaveLength(12);
    expect(simulate(1, [], 1)[0]).toHaveLength(1);
    const small = pool.slice(0, 3);
    expect(pickDailyQuests({ pool: small, focusAreas: [], count: 5, seed: "s", lastSeen: new Map() })).toHaveLength(3);
    expect(pickDailyQuests({ pool: [], focusAreas: [], count: 5, seed: "s", lastSeen: new Map() })).toEqual([]);
  });

  it("still fills the day when a focus area doesn't exist in the pool", () => {
    const onlyFitness = pool.filter((t) => t.category === "fitness");
    const picks = pickDailyQuests({ pool: onlyFitness, focusAreas: ["social"], count: 3, seed: "s", lastSeen: new Map() });
    expect(picks).toHaveLength(3);
  });
});
