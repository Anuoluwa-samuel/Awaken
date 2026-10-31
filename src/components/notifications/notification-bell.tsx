"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { useState } from "react";
import { MarkAllRead } from "./mark-all-read";
import { NotificationItem, type NotificationView } from "./notification-item";

/** Header notifications panel: latest messages, unread badge, mark-all-read. */
export function NotificationBell({ latest, unread }: { latest: NotificationView[]; unread: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative grid size-9 place-items-center rounded-md border border-line text-ink-muted hover:border-line-strong hover:text-ink"
      >
        <Bell aria-hidden className="size-4" />
        {unread > 0 ? (
          <span aria-hidden className="absolute -right-1 -top-1 min-w-4 rounded-full bg-glow px-1 text-center font-mono text-[10px] font-semibold leading-4 text-bg">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(92vw,360px)] animate-rise overflow-hidden rounded-lg border border-line-strong bg-panel shadow-panel"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">System messages</p>
            <MarkAllRead disabled={unread === 0} />
          </div>
          {latest.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">No messages yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {latest.map((n) => (
                <NotificationItem key={n.id} n={n} compact onNavigate={() => setOpen(false)} />
              ))}
            </ul>
          )}
          <Link
            href="/system/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-3 py-2 text-center text-xs text-glow hover:underline"
          >
            View all
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
