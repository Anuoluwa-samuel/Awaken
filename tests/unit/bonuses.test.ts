import { describe, expect, it } from "vitest";
import {
  BONUS_RULES,
  comboBonus,
  dayStreak,
  flameTier,
  isEventDay,
  pickBossKey,
  pickEventTemplate,
  verifiedBonus,
} from "@/lib/progression/bonuses";
import { reminderMessage } from "@/lib/reminders";
import { addDays } from "@/lib/time";
import { suggestFocus } from "@/server/services/report";

// 2026-11-09 is a Monday.
const MON = "2026-11-09";
const days = (...offsets: number[]) => offsets.map((o) => addDays(MON, o));

describe("day streak with freezes", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(dayStreak(days(0, 1, 2), addDays(MON, 2)).current).toBe(3);
    expect(dayStreak(days(0, 1, 2), addDays(MON, 3)).current).toBe(3); // today not over yet
  });

  it("forgives one missed day a week, between active days", () => {
    // Active Mon, Tue, Thu, Fri: Wednesday is frozen.
    const s = dayStreak(days(0, 1, 3, 4), addDays(MON, 4));
    expect(s).toMatchObject({ current: 4, frozen: [addDays(MON, 2)], freezeAvailable: false });
  });

  it("covers yesterday while today is still open", () => {
    const s = dayStreak(days(0, 1), addDays(MON, 3)); // Wed missed, Thu not done yet
    expect(s.current).toBe(2);
    expect(s.frozen).toEqual([addDays(MON, 2)]);
  });

  it("doesn't forgive a second miss in the same week, or two days in a row", () => {
    expect(dayStreak(days(0, 2, 4), addDays(MON, 4)).current).toBe(2); // Tue frozen, Thu not
    expect(dayStreak(days(0, 1), addDays(MON, 4)).current).toBe(0); // Wed and Thu both missed
  });

  it("gives each week its own freeze", () => {
    // Sun of the week before missed (frozen there), Wednesday this week missed (frozen here).
    const active = [...days(-3, -2, 0, 1, 3)];
    expect(dayStreak(active, addDays(MON, 3))).toMatchObject({ current: 5, freezeAvailable: false });
  });

  it("is zero with nothing done", () => {
    expect(dayStreak([], MON)).toMatchObject({ current: 0, frozen: [], freezeAvailable: true });
  });
});

describe("bonuses", () => {
  it("combo is a share of the day's quest XP, with a minimum", () => {
    expect(comboBonus(10)).toBe(BONUS_RULES.comboMinimum);
    expect(comboBonus(200)).toBe(40);
    expect(verifiedBonus(10)).toBe(BONUS_RULES.verifiedMinimum);
    expect(verifiedBonus(100)).toBe(20);
  });

  it("events land on roughly one day in six, and the same day always agrees", () => {
    const hits = Array.from({ length: 600 }, (_, i) => isEventDay("player-1", addDays(MON, i))).filter(Boolean).length;
    expect(hits).toBeGreaterThan(60);
    expect(hits).toBeLessThan(150);
    expect(isEventDay("p", MON)).toBe(isEventDay("p", MON));
  });

  it("event quests prefer focus areas and skip excluded ones", () => {
    const pool = [
      { id: "a", category: "fitness" as const },
      { id: "b", category: "learning" as const },
      { id: "c", category: "learning" as const },
    ];
    expect(pickEventTemplate(pool, new Set(["b"]), ["learning"], "s")?.id).toBe("c");
    expect(pickEventTemplate(pool, new Set(["b", "c"]), ["learning"], "s")?.id).toBe("a");
    expect(pickEventTemplate(pool, new Set(["a", "b", "c"]), [], "s")).toBeNull();
  });

  it("the boss is fixed for a week and varies between weeks", () => {
    const keys = ["x", "y", "z", "w"];
    expect(pickBossKey(keys, "p", MON)).toBe(pickBossKey(keys, "p", MON));
    const weeks = new Set(Array.from({ length: 20 }, (_, i) => pickBossKey(keys, "p", addDays(MON, i * 7))));
    expect(weeks.size).toBeGreaterThan(1);
    expect(pickBossKey([], "p", MON)).toBeNull();
  });

  it("flames grow at 7, 30 and 100 days", () => {
    expect(flameTier(0).tier).toBe(0);
    expect(flameTier(1).tier).toBe(1);
    expect(flameTier(7).tier).toBe(2);
    expect(flameTier(30).tier).toBe(3);
    expect(flameTier(100).tier).toBe(4);
  });
});

describe("evening reminder wording", () => {
  it("says nothing when the day is done", () => {
    expect(reminderMessage(0, 5, 3, true)).toBeNull();
  });
  it("warns about a streak at risk", () => {
    expect(reminderMessage(2, 5, 6, false)?.body).toBe("2 quests left today. Complete one to keep your 6-day streak.");
  });
  it("nudges toward the combo once something is done", () => {
    expect(reminderMessage(1, 5, 6, true)?.body).toMatch(/^1 quest left today\. Finish them all/);
  });
  it("invites a player who hasn't opened the app today", () => {
    expect(reminderMessage(0, 0, 0, false)?.title).toBe("Your daily quests are waiting");
    expect(reminderMessage(0, 0, 4, false)?.title).toBe("Your streak needs you");
  });
});

describe("weekly report suggestion", () => {
  it("points at the least-trained attribute", () => {
    const s = suggestFocus({ strength: 9, intelligence: 4, discipline: 6, vitality: 5, creativity: 0 });
    expect(s).toEqual({ attribute: "creativity", category: "creativity" });
  });
});
