import { notification } from "@/db/schema";
import type { AppDb } from "@/db/types";

export type NewNotification = {
  userId: string;
  type: "level_up" | "rank_up" | "achievement" | "quest" | "weekly" | "deadline" | "system";
  title: string;
  body?: string;
  href?: string;
  /** Globally unique per event, so retries and repeated requests never notify twice. */
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
