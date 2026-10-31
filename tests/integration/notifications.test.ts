import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notification } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { createGoal } from "@/server/services/goals";
import {
  ensureDeadlineNotifications,
  listNotifications,
  markAllRead,
  markRead,
  notify,
  unreadCount,
} from "@/server/services/notifications";
import { createPlayer } from "@/server/services/player";
import { createCustomQuest, ensureDailyQuests } from "@/server/services/quests";
import { createTestDb, createUser } from "./helpers";

let db: AppDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(async () => close());

const at = (iso: string) => new Date(iso);
async function newPlayer() {
  const userId = await createUser(db);
  await createPlayer(
    db,
    userId,
    { displayName: "P", timeZone: "Africa/Lagos", dayStartHour: 4, focusAreas: ["learning"], preferredDifficulty: "normal", dailyTarget: null },
    at("2026-10-27T10:00:00Z"),
  );
  return userId;
}
const ofType = (userId: string, type: string) =>
  db.query.notification.findMany({ where: and(eq(notification.userId, userId), eq(notification.type, type)) });

describe("daily quest notices", () => {
  it("announces each quest day once", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < 3; i++) await ensureDailyQuests(db, userId, at("2026-10-27T15:00:00Z"));
    await ensureDailyQuests(db, userId, at("2026-10-28T10:00:00Z"));
    const daily = await ofType(userId, "daily");
    expect(daily.map((n) => n.dedupeKey).sort()).toEqual([`daily:${userId}:2026-10-27`, `daily:${userId}:2026-10-28`]);
  });
});

describe("deadline reminders", () => {
  it("reminds about goals due within two days, once per deadline", async () => {
    const userId = await newPlayer();
    const now = at("2026-10-27T10:00:00Z");
    await createGoal(db, userId, { title: "Soon", description: "", category: "career", deadline: "2026-10-28", milestones: ["A"] }, now);
    await createGoal(db, userId, { title: "Later", description: "", category: "career", deadline: "2026-11-15", milestones: ["A"] }, now);
    for (let i = 0; i < 3; i++) await ensureDeadlineNotifications(db, userId, "2026-10-27", now);
    const reminders = await ofType(userId, "deadline");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toContain("“Soon” is due tomorrow");
  });

  it("reminds about one-off quests due within 24 hours, not overdue ones", async () => {
    const userId = await newPlayer();
    const now = at("2026-10-27T10:00:00Z");
    const base = { description: "", category: "career" as const, difficulty: "easy" as const, attribute: null, xpReward: null, scheduleType: "once" as const, days: [], estimatedMinutes: null, checklist: [] };
    await createCustomQuest(db, userId, { ...base, title: "Due tonight", targetDate: "2026-10-27" }, now); // ends 03:00Z on 28th
    await createCustomQuest(db, userId, { ...base, title: "Next week", targetDate: "2026-11-03" }, now);
    await ensureDeadlineNotifications(db, userId, "2026-10-27", now);
    const reminders = await ofType(userId, "deadline");
    expect(reminders.map((r) => r.body)).toEqual([expect.stringContaining("Due tonight")]);
  });
});

describe("read state", () => {
  it("marks only the owner's notifications read", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await notify(db, { userId: a, type: "system", title: "A", dedupeKey: `t:${a}:1` });
    await notify(db, { userId: b, type: "system", title: "B", dedupeKey: `t:${b}:1` });
    const [bNote] = (await listNotifications(db, b)).items.filter((n) => n.title === "B");
    const unreadBefore = await unreadCount(db, b);

    expect(await markRead(db, a, [bNote.id])).toBe(0); // another player's id is ignored
    expect(await unreadCount(db, b)).toBe(unreadBefore);
    expect(await markRead(db, b, [bNote.id])).toBe(1);
    expect(await markRead(db, b, [bNote.id])).toBe(0); // already read

    expect(await markAllRead(db, a)).toBeGreaterThan(0);
    expect(await unreadCount(db, a)).toBe(0);
    expect(await unreadCount(db, b)).toBe(unreadBefore - 1);
  });

  it("paginates newest first without gaps or repeats", async () => {
    const userId = await newPlayer();
    for (let i = 0; i < 7; i++) {
      await notify(db, { userId, type: "system", title: `N${i}`, dedupeKey: `p:${userId}:${i}`, createdAt: new Date(Date.UTC(2026, 9, 1, i)) });
    }
    const all = (await listNotifications(db, userId, { limit: 100 })).items.map((n) => n.id);
    const seen: string[] = [];
    let before: Date | undefined;
    for (;;) {
      const page = await listNotifications(db, userId, { before, limit: 3 });
      seen.push(...page.items.map((n) => n.id));
      if (!page.hasMore) break;
      before = page.items.at(-1)!.createdAt;
    }
    expect(seen).toEqual(all);
  });
});
