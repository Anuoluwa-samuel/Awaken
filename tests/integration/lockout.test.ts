import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notification } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { clearLockout, lockoutStatus, recordFailure, reserveAttempt } from "@/server/services/lockout";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const T0 = new Date("2026-10-31T10:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
let n = 0;
const freshEmail = () => `lock${++n}@awaken.test`;

/** One wrong-password sign-in as the hooks perform it. Returns what the player would see. */
async function wrongPassword(email: string, now: Date) {
  const reserved = await reserveAttempt(db, email, now);
  if (!reserved.allowed) return { locked: true, seconds: reserved.retryAfterSeconds };
  const after = await recordFailure(db, email, now);
  return after && !after.allowed ? { locked: true, seconds: after.retryAfterSeconds } : { locked: false };
}

describe("account lockout", () => {
  it("locks for 10 minutes on the 5th wrong password", async () => {
    const email = freshEmail();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await wrongPassword(email, at(0)));
    expect(results.slice(0, 4).every((r) => !r.locked)).toBe(true);
    expect(results[4]).toEqual({ locked: true, seconds: 600 });
  });

  it("refuses every attempt while locked — even before the password is checked", async () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) await wrongPassword(email, at(0));
    expect(await reserveAttempt(db, email, at(5))).toMatchObject({ allowed: false, retryAfterSeconds: 300 });
    expect(await reserveAttempt(db, email, at(9.9))).toMatchObject({ allowed: false });
  });

  it("escalates after the countdown expires: 10, then 20, then 40 minutes", async () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) await wrongPassword(email, at(0));
    expect(await lockoutStatus(db, email, at(1))).toMatchObject({ locked: true, retryAfterSeconds: 540 });

    // Lock over: a fresh 5 tries, then a 20-minute lock.
    let last;
    for (let i = 0; i < 5; i++) last = await wrongPassword(email, at(11));
    expect(last).toEqual({ locked: true, seconds: 20 * 60 });

    for (let i = 0; i < 5; i++) last = await wrongPassword(email, at(32));
    expect(last).toEqual({ locked: true, seconds: 40 * 60 });
  });

  it("a successful sign-in resets attempts and escalation", async () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) await wrongPassword(email, at(0));
    expect((await reserveAttempt(db, email, at(11))).allowed).toBe(true);
    await clearLockout(db, email); // the correct password
    let last;
    for (let i = 0; i < 5; i++) last = await wrongPassword(email, at(12));
    expect(last).toEqual({ locked: true, seconds: 600 }); // back to level 1
  });

  it("a password reset lifts an active lock", async () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) await wrongPassword(email, at(0));
    await clearLockout(db, email);
    expect(await lockoutStatus(db, email, at(1))).toMatchObject({ locked: false, attempts: 0 });
    expect((await reserveAttempt(db, email, at(1))).allowed).toBe(true);
  });

  it("forgets escalation after 24 hours without attempts", async () => {
    const email = freshEmail();
    for (let i = 0; i < 5; i++) await wrongPassword(email, at(0));
    for (let i = 0; i < 5; i++) await wrongPassword(email, at(11)); // level 2
    let last;
    for (let i = 0; i < 5; i++) last = await wrongPassword(email, at(11 + 25 * 60));
    expect(last).toEqual({ locked: true, seconds: 600 });
  });

  it("notifies the owner once per lock, and treats unknown emails identically", async () => {
    const userId = await createUser(db);
    const email = `${userId}@example.test`;
    for (let i = 0; i < 5; i++) await wrongPassword(email, at(0));
    for (let i = 0; i < 3; i++) await reserveAttempt(db, email, at(1)); // refused, no new lock
    const notes = await db.query.notification.findMany({
      where: and(eq(notification.userId, userId), eq(notification.title, "Sign-in locked")),
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toContain("10 minutes");

    const ghost = "nobody-here@awaken.test";
    let last;
    for (let i = 0; i < 5; i++) last = await wrongPassword(ghost, at(0));
    expect(last).toEqual({ locked: true, seconds: 600 });
  });
});
