import { desc, eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { getPlayerContext } from "@/server/player-context";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { user } = await getPlayerContext();
  const items = await db.query.notification.findMany({
    where: eq(notification.userId, user.id),
    orderBy: [desc(notification.createdAt)],
    limit: 50,
  });

  return (
    <Panel>
      <PanelHeader as="h1" eyebrow="System messages" title="Notifications" />
      {items.length === 0 ? (
        <EmptyState icon={Bell}>No system messages yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((n) => (
            <li key={n.id} className="px-5 py-3.5">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-glow">{n.title}</p>
              {n.body ? <p className="mt-1 text-sm text-ink-muted">{n.body}</p> : null}
              <time className="mt-1 block text-xs text-ink-faint" dateTime={n.createdAt.toISOString()}>
                {n.createdAt.toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
