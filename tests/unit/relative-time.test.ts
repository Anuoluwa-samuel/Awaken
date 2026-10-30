import { describe, expect, it } from "vitest";
import { relativeTime } from "@/components/player/activity-feed";

describe("relativeTime", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  it("formats recent and older times", () => {
    expect(relativeTime(new Date("2026-10-30T11:59:40Z"), now)).toBe("just now");
    expect(relativeTime(new Date("2026-10-30T11:55:00Z"), now)).toBe("5 minutes ago");
    expect(relativeTime(new Date("2026-10-30T09:00:00Z"), now)).toBe("3 hours ago");
    expect(relativeTime(new Date("2026-10-29T12:00:00Z"), now)).toBe("yesterday");
  });
});
