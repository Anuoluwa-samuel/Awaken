import { and, eq, inArray, notInArray } from "drizzle-orm";
import { playerProfile, playerQuest, pushSubscription } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { reminderMessage } from "@/lib/reminders";
import { questDay } from "@/lib/time";
import { consumeDaily } from "./limits";
import { getDayStreak } from "./streak";

// The evening reminder: opt-in per browser, at most one a day, only when there's something to do.

export const REMINDER_RULES = {
  /** Local hour the reminder goes out. */
  hour: 19,
  maxBrowsersPerPlayer: 5,
} as const;

export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Saves (or moves to this player) a browser subscription. Keeps the newest few per player. */
export async function savePushSubscription(db: AppDb, userId: string, sub: BrowserSubscription) {
  await db.transaction(async (tx) => {
    await tx
      .insert(pushSubscription)
      .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, createdAt: new Date() },
      });
    const mine = await tx.query.pushSubscription.findMany({
      where: eq(pushSubscription.userId, userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      columns: { id: true },
    });
    const keep = mine.slice(0, REMINDER_RULES.maxBrowsersPerPlayer).map((s) => s.id);
    await tx.delete(pushSubscription).where(and(eq(pushSubscription.userId, userId), notInArray(pushSubscription.id, keep)));
  });
}

export async function deletePushSubscription(db: AppDb, userId: string, endpoint: string) {
  await db.delete(pushSubscription).where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
}

export async function hasPushSubscription(db: AppDb, userId: string) {
  return !!(await db.query.pushSubscription.findFirst({ where: eq(pushSubscription.userId, userId), columns: { id: true } }));
}

/** Hour of day in a time zone. */
function localHour(now: Date, timeZone: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(now));
}

/**
 * Sends the reminder to every subscribed player whose local time is the reminder hour. Run hourly.
 * The daily counter makes a repeat run in the same hour (or a retry) send nothing more.
 */
export type PushSender = (
  sub: typeof pushSubscription.$inferSelect,
  payload: { title: string; body: string; url: string },
) => Promise<boolean>;

export async function sendEveningReminders(db: AppDb, send: PushSender, now = new Date()) {
  const subs = await db.select().from(pushSubscription);
  const userIds = [...new Set(subs.map((s) => s.userId))];
  if (userIds.length === 0) return { players: 0, sent: 0, removed: 0 };
  const profiles = await db.query.playerProfile.findMany({
    where: inArray(playerProfile.userId, userIds),
    columns: { userId: true, timeZone: true, dayStartHour: true },
  });

  let players = 0;
  let sent = 0;
  const gone: string[] = [];
  for (const p of profiles) {
    if (localHour(now, p.timeZone) !== REMINDER_RULES.hour) continue;
    const today = questDay(now, p.timeZone, p.dayStartHour);
    const quests = await db
      .select({ status: playerQuest.status })
      .from(playerQuest)
      .where(and(eq(playerQuest.userId, p.userId), eq(playerQuest.questDate, today)));
    const open = quests.filter((q) => q.status === "available" || q.status === "in_progress").length;
    const streak = await getDayStreak(db, p.userId, { today, timeZone: p.timeZone, dayStartHour: p.dayStartHour });
    const activeToday = quests.some((q) => q.status === "completed");
    const message = reminderMessage(open, quests.length, streak.current, activeToday);
    if (!message) continue;
    if (!(await consumeDaily(db, p.userId, "push_reminder", 1, now))) continue;
    players++;
    for (const s of subs.filter((x) => x.userId === p.userId)) {
      const ok = await send(s, { ...message, url: "/system/quests" });
      if (ok) sent++;
      else gone.push(s.id);
    }
  }
  if (gone.length) await db.delete(pushSubscription).where(inArray(pushSubscription.id, gone));
  return { players, sent, removed: gone.length };
}
