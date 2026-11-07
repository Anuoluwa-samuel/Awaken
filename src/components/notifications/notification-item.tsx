"use client";

import {
  Award,
  Bell,
  CalendarCheck,
  CalendarClock,
  ChevronsUp,
  Crown,
  Flag,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markReadAction } from "@/app/system/notifications/actions";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<string, LucideIcon> = {
  level_up: ChevronsUp,
  rank_up: Crown,
  achievement: Award,
  weekly: CalendarCheck,
  daily: ScrollText,
  deadline: CalendarClock,
  system: Flag,
};

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/** A notification row; opening it marks it read and follows its link. */
export function NotificationItem({ n, compact = false, onNavigate }: { n: NotificationView; compact?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = ICONS[n.type] ?? Bell;
  const unread = !n.readAt;

  const open = () =>
    startTransition(async () => {
      if (unread) await markReadAction([n.id]);
      onNavigate?.();
      if (n.href) router.push(n.href);
      else router.refresh();
    });

  return (
    <li>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={cn(
          "flex w-full items-start gap-3 text-left transition-colors hover:bg-panel-raised focus-visible:bg-panel-raised",
          compact ? "px-3 py-2.5" : "px-5 py-3.5",
          unread && "bg-glow-soft/40",
        )}
      >
        <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", unread ? "text-glow" : "text-ink-faint")} />
        <span className="min-w-0 flex-1">
          <span className={cn("block font-display text-xs font-semibold uppercase tracking-[0.15em]", unread ? "text-ink" : "text-ink-muted")}>
            {n.title}
            {unread ? <span className="sr-only"> (unread)</span> : null}
          </span>
          {n.body ? <span className={cn("mt-0.5 block text-sm text-ink-muted", compact && "line-clamp-2")}>{n.body}</span> : null}
          <time className="mt-0.5 block text-[11px] text-ink-faint" dateTime={n.createdAt.toISOString()}>
            {n.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </time>
        </span>
        {unread ? <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-glow shadow-[0_0_6px_#2583ff]" /> : null}
      </button>
    </li>
  );
}
