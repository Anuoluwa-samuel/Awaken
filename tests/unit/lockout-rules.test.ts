import { describe, expect, it } from "vitest";
import { describeWait, LOCKOUT, lockMinutes, normaliseEmail } from "@/lib/auth/lockout-rules";

describe("lockout rules", () => {
  it("starts at 10 minutes and doubles each consecutive lock", () => {
    expect([1, 2, 3, 4, 5].map(lockMinutes)).toEqual([10, 20, 40, 80, 160]);
  });

  it("caps at 24 hours", () => {
    expect(lockMinutes(9)).toBe(LOCKOUT.maxMinutes);
    expect(lockMinutes(50)).toBe(24 * 60);
  });

  it("rejects invalid levels", () => {
    expect(() => lockMinutes(0)).toThrow(RangeError);
    expect(() => lockMinutes(1.5)).toThrow(RangeError);
  });

  it("normalises emails so case and spaces can't dodge the counter", () => {
    expect(normaliseEmail("  Hunter@Awaken.Test ")).toBe("hunter@awaken.test");
    expect(normaliseEmail("")).toBeNull();
    expect(normaliseEmail(42)).toBeNull();
  });

  it("describes waits in plain words", () => {
    expect(describeWait(30)).toBe("30 seconds");
    expect(describeWait(600)).toBe("10 minutes");
    expect(describeWait(61)).toBe("2 minutes");
    expect(describeWait(4800)).toBe("1 hour 20 min");
  });
});
