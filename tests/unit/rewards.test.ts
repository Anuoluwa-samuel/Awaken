import { describe, expect, it } from "vitest";
import { xpToReach } from "@/lib/progression/levels";
import {
  applyXp,
  attributePointsFor,
  resolveQuestXp,
} from "@/lib/progression/rewards";

describe("resolveQuestXp", () => {
  it("uses difficulty defaults", () => {
    expect(resolveQuestXp("easy")).toBe(10);
    expect(resolveQuestXp("normal")).toBe(25);
    expect(resolveQuestXp("hard")).toBe(50);
    expect(resolveQuestXp("elite")).toBe(100);
  });

  it("clamps requested custom values", () => {
    expect(resolveQuestXp("easy", 1_000_000)).toBe(20);
    expect(resolveQuestXp("normal", 0)).toBe(5);
    expect(resolveQuestXp("normal", -50)).toBe(5);
    expect(resolveQuestXp("hard", 42.7)).toBe(43);
    expect(resolveQuestXp("hard", Number.NaN)).toBe(50);
  });
});

describe("applyXp", () => {
  it("handles a reward that lands exactly on the threshold", () => {
    const c = applyXp(90, 10);
    expect(c).toMatchObject({ fromLevel: 1, toLevel: 2, levelsGained: 1, skillPointsGained: 1 });
  });

  it("handles multiple level-ups from one reward", () => {
    const c = applyXp(0, xpToReach(5));
    expect(c.toLevel).toBe(5);
    expect(c.levelsGained).toBe(4);
  });

  it("detects rank changes", () => {
    const c = applyXp(xpToReach(10) - 1, 1);
    expect(c).toMatchObject({ fromRank: "E", toRank: "D", rankChanged: true });
  });

  it("rejects negative or fractional grants", () => {
    expect(() => applyXp(0, -10)).toThrow(RangeError);
    expect(() => applyXp(0, 2.5)).toThrow(RangeError);
  });
});

describe("caps", () => {
  it("applies the daily attribute cap", () => {
    expect(attributePointsFor("elite", 0)).toBe(5);
    expect(attributePointsFor("elite", 8)).toBe(2);
    expect(attributePointsFor("easy", 10)).toBe(0);
  });
});
