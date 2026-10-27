import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/db/types";
import { createPlayer, updateSettings } from "@/server/services/player";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const base = {
  displayName: "Jin",
  timeZone: "UTC",
  dayStartHour: 4,
  focusAreas: [],
  preferredDifficulty: "normal" as const,
  dailyTarget: null,
};

describe("updateSettings", () => {
  it("rate-limits day-boundary changes to stop quest-set farming", async () => {
    const userId = await createUser(db);
    const t0 = new Date("2026-10-27T10:00:00Z");
    await createPlayer(db, userId, base, t0);

    expect(await updateSettings(db, userId, { ...base, timeZone: "Asia/Tokyo" }, t0)).toEqual({ ok: true });
    const blocked = await updateSettings(db, userId, { ...base, timeZone: "America/Chicago" }, new Date("2026-10-30T10:00:00Z"));
    expect(blocked.ok).toBe(false);

    // Other fields are still editable during the cooldown.
    expect(
      await updateSettings(db, userId, { ...base, timeZone: "Asia/Tokyo", displayName: "Sung" }, new Date("2026-10-30T10:00:00Z")),
    ).toEqual({ ok: true });

    expect(
      await updateSettings(db, userId, { ...base, timeZone: "America/Chicago" }, new Date("2026-11-04T11:00:00Z")),
    ).toEqual({ ok: true });
  });

  it("fails for a user without a player profile", async () => {
    const userId = await createUser(db);
    expect((await updateSettings(db, userId, base)).ok).toBe(false);
  });
});
