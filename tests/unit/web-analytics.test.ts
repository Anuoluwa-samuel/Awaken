import { describe, expect, it } from "vitest";
import { redactAnalyticsUrl } from "@/lib/web-analytics";

const ORIGIN = "https://awaken.example";

describe("redactAnalyticsUrl", () => {
  it("drops emails, reset tokens and redirect targets from the query", () => {
    expect(redactAnalyticsUrl(`${ORIGIN}/verify-email?email=jin%40gmail.com`)).toBe(`${ORIGIN}/verify-email`);
    expect(redactAnalyticsUrl(`${ORIGIN}/reset-password?token=abc123`)).toBe(`${ORIGIN}/reset-password`);
    expect(redactAnalyticsUrl(`${ORIGIN}/login?next=%2Fsystem%2Fquests`)).toBe(`${ORIGIN}/login`);
    expect(redactAnalyticsUrl(`${ORIGIN}/?account=deleted#features`)).toBe(`${ORIGIN}/`);
  });

  it("replaces record ids with [id]", () => {
    expect(redactAnalyticsUrl(`${ORIGIN}/system/quests/0b35ce04-7fba-499b-abf3-8048555d1669`)).toBe(
      `${ORIGIN}/system/quests/[id]`,
    );
  });

  it("keeps useful, non-personal parameters", () => {
    expect(redactAnalyticsUrl(`${ORIGIN}/system/progress?range=30d&email=x`)).toBe(`${ORIGIN}/system/progress?range=30d`);
    expect(redactAnalyticsUrl(`${ORIGIN}/system/quests/new`)).toBe(`${ORIGIN}/system/quests/new`);
  });
});
