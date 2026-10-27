import { describe, expect, it } from "vitest";
import { RANKS } from "@/lib/progression/config";
import {
  levelFromXp,
  levelProgress,
  rankForLevel,
  rankProgress,
  xpForLevelUp,
  xpToReach,
} from "@/lib/progression/levels";

describe("level curve", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(xpToReach(1)).toBe(0);
    expect(levelFromXp(0)).toBe(1);
  });

  it("matches the documented thresholds", () => {
    expect(xpToReach(2)).toBe(100);
    expect(xpToReach(5)).toBe(520);
    expect(xpToReach(10)).toBe(1620);
    expect(xpToReach(50)).toBe(28420);
    expect(xpToReach(90)).toBe(87220);
  });

  it("each level costs more than the last", () => {
    for (let l = 1; l < 200; l++) expect(xpForLevelUp(l + 1)).toBeGreaterThan(xpForLevelUp(l));
  });

  it("cumulative thresholds equal the sum of steps", () => {
    let sum = 0;
    for (let l = 1; l <= 150; l++) {
      expect(xpToReach(l)).toBe(sum);
      sum += xpForLevelUp(l);
    }
  });

  it("levels up at exactly the threshold, not one XP before", () => {
    for (let l = 2; l <= 300; l++) {
      expect(levelFromXp(xpToReach(l) - 1)).toBe(l - 1);
      expect(levelFromXp(xpToReach(l))).toBe(l);
    }
  });

  it("rejects invalid input", () => {
    expect(() => levelFromXp(-1)).toThrow(RangeError);
    expect(() => levelFromXp(1.5)).toThrow(RangeError);
    expect(() => xpToReach(0)).toThrow(RangeError);
  });

  it("reports in-level progress", () => {
    const p = levelProgress(150);
    expect(p).toMatchObject({ level: 2, xpIntoLevel: 50, xpForNext: 120, xpRemaining: 70 });
    expect(p.ratio).toBeCloseTo(50 / 120);
    expect(levelProgress(xpToReach(3)).xpIntoLevel).toBe(0);
  });
});

describe("ranks", () => {
  it("maps every documented boundary", () => {
    for (const rank of RANKS) {
      expect(rankForLevel(rank.minLevel).id).toBe(rank.id);
      if (rank.minLevel > 1) expect(rankForLevel(rank.minLevel - 1).id).not.toBe(rank.id);
    }
    expect(rankForLevel(1).label).toBe("E-Rank");
    expect(rankForLevel(500).label).toBe("National-Level");
  });

  it("keeps the top ranks reachable within ~2 years at a modest pace", () => {
    const xpPerDay = 150;
    const national = RANKS.at(-1)!;
    expect(xpToReach(national.minLevel) / xpPerDay).toBeLessThan(730);
  });

  it("reports progress toward the next rank", () => {
    const start = rankProgress(0);
    expect(start.rank.id).toBe("E");
    expect(start.next?.id).toBe("D");
    expect(start.xpToNextRank).toBe(xpToReach(10));
    expect(rankProgress(xpToReach(90)).next).toBeNull();
  });
});
