import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarkAllRead } from "@/components/notifications/mark-all-read";
import { NotificationItem } from "@/components/notifications/notification-item";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { getPlayerContext } from "@/server/player-context";
import { listNotifications, unreadCount } from "@/server/services/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/system/notifications">) {
  const { before } = await searchParams;
  const cursor = typeof before === "string" && !Number.isNaN(Date.parse(before)) ? new Date(before) : undefined;
  const { user } = await getPlayerContext();
  const [{ items, hasMore }, unread] = await Promise.all([
    listNotifications(db, user.id, { before: cursor }),
    unreadCount(db, user.id),
  ]);

  return (
    <Panel>
      <PanelHeader
        as="h1"
        eyebrow={unread ? `${unread} unread` : "All caught up"}
        title="Notifications"
        action={<MarkAllRead disabled={unread === 0} />}
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell}>{cursor ? "No older messages." : "No system messages yet."}</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((n) => (
            <NotificationItem key={n.id} n={n} />
          ))}
        </ul>
      )}
      <div className="flex justify-between border-t border-line px-5 py-3 text-sm">
        {cursor ? (
          <Link href="/system/notifications" className="text-ink-muted hover:text-ink">
            ← Newest
          </Link>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Link href={`/system/notifications?before=${encodeURIComponent(items.at(-1)!.createdAt.toISOString())}`} className="text-glow hover:underline">
            Older →
          </Link>
        ) : null}
      </div>
    </Panel>
  );
}
