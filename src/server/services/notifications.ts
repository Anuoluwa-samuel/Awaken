import { and, desc, eq, gt, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { goal, notification, playerQuest, weeklyChallenge } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { addDays, type QuestDate } from "@/lib/time";

// In-app notifications — docs/ARCHITECTURE.md §6f. Every notification carries a globally unique
// dedupe key, so retries, refreshes and parallel requests can never create a duplicate.

export type NotificationType =
  | "level_up"
  | "rank_up"
  | "achievement"
  | "quest"
  | "weekly"
  | "daily"
  | "deadline"
  | "system";

export type NewNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  dedupeKey: string;
  createdAt?: Date;
};

/** Inserts a notification once; repeated calls with the same dedupe key are no-ops. */
export async function notify(db: AppDb, n: NewNotification): Promise<boolean> {
  const rows = await db
    .insert(notification)
    .values({ ...n, body: n.body ?? "" })
    .onConflictDoNothing({ target: notification.dedupeKey })
    .returning({ id: notification.id });
  return rows.length > 0;
}

export const NOTIFICATION_PAGE_SIZE = 30;

/** Newest first, keyset-paginated by creation time (`before` = the last item's timestamp). */
export async function listNotifications(db: AppDb, userId: string, opts: { before?: Date; limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? NOTIFICATION_PAGE_SIZE, 100);
  const rows = await db.query.notification.findMany({
    where: and(eq(notification.userId, userId), opts.before ? lt(notification.createdAt, opts.before) : undefined),
    orderBy: [desc(notification.createdAt), desc(notification.id)],
    limit: limit + 1,
  });
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

export async function unreadCount(db: AppDb, userId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return n;
}

/** Marks notifications read — only the owner's; others' ids are silently ignored. */
export async function markRead(db: AppDb, userId: string, ids: string[], now = new Date()) {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(notification)
    .set({ readAt: now })
    .where(and(eq(notification.userId, userId), inArray(notification.id, ids), isNull(notification.readAt)))
    .returning({ id: notification.id });
  return rows.length;
}

export async function markAllRead(db: AppDb, userId: string, now = new Date()) {
  const rows = await db
    .update(notification)
    .set({ readAt: now })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)))
    .returning({ id: notification.id });
  return rows.length;
}

export const DEADLINE_RULES = {
  /** Goals: remind when the deadline is within this many quest days (today counts). */
  goalDaysAhead: 2,
  /** One-off quests and weekly challenges: remind within this many hours of the deadline. */
  hoursAhead: 24,
} as const;

/**
 * Creates upcoming-deadline reminders for open goals, one-off quests and unfinished weekly
 * challenges. Idempotent: one reminder per item per deadline.
 */
export async function ensureDeadlineNotifications(db: AppDb, userId: string, today: QuestDate, now = new Date()) {
  const soon = new Date(now.getTime() + DEADLINE_RULES.hoursAhead * 3_600_000);
  const [goals, quests, challenges] = await Promise.all([
    db.query.goal.findMany({
      where: and(
        eq(goal.userId, userId),
        eq(goal.status, "active"),
        sql`${goal.deadline} between ${today} and ${addDays(today, DEADLINE_RULES.goalDaysAhead)}`,
      ),
      columns: { id: true, title: true, deadline: true },
    }),
    db.query.playerQuest.findMany({
      where: and(
        eq(playerQuest.userId, userId),
        isNull(playerQuest.templateId),
        inArray(playerQuest.status, ["available", "in_progress"]),
        gt(playerQuest.dueAt, now),
        lte(playerQuest.dueAt, soon),
      ),
      columns: { id: true, title: true, dueAt: true },
    }),
    db.query.weeklyChallenge.findMany({
      where: and(
        eq(weeklyChallenge.userId, userId),
        eq(weeklyChallenge.status, "active"),
        gt(weeklyChallenge.deadlineAt, now),
        lte(weeklyChallenge.deadlineAt, soon),
      ),
      columns: { id: true, title: true, progress: true, target: true, deadlineAt: true },
    }),
  ]);

  for (const g of goals) {
    const days = g.deadline === today ? "today" : g.deadline === addDays(today, 1) ? "tomorrow" : `on ${g.deadline}`;
    await notify(db, {
      userId,
      type: "deadline",
      title: "Goal deadline approaching",
      body: `“${g.title}” is due ${days}.`,
      href: "/system/goals",
      dedupeKey: `deadline:goal:${g.id}:${g.deadline}`,
      createdAt: now,
    });
  }
  for (const q of quests) {
    await notify(db, {
      userId,
      type: "deadline",
      title: "Quest due soon",
      body: `“${q.title}” is due within ${DEADLINE_RULES.hoursAhead} hours.`,
      href: `/system/quests/${q.id}`,
      dedupeKey: `deadline:quest:${q.id}:${q.dueAt!.toISOString()}`,
      createdAt: now,
    });
  }
  for (const c of challenges) {
    await notify(db, {
      userId,
      type: "deadline",
      title: "Weekly challenge ends soon",
      body: `${c.title}: ${c.progress}/${c.target} with less than a day left.`,
      href: "/system/quests",
      dedupeKey: `deadline:weekly:${c.id}`,
      createdAt: now,
    });
  }
}
