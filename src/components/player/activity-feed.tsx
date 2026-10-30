import { Award, CalendarCheck, ChevronsUp, History, Repeat, ScrollText, Timer, Wrench, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { RANKS } from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";
import type { ActivityItem } from "@/server/services/dashboard";

const XP_ICON: Record<Extract<ActivityItem, { kind: "xp" }>["eventType"], LucideIcon> = {
  quest_completed: ScrollText,
  habit_completed: Repeat,
  weekly_completed: CalendarCheck,
  achievement_unlocked: Award,
  focus_completed: Timer,
  goal_completed: Award,
  adjustment: Wrench,
};

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relativeTime(at: Date, now = new Date()): string {
  const s = Math.round((at.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return at.toLocaleDateString();
}

const rankLabel = (id: string) => RANKS.find((r) => r.id === id)?.label ?? id;

export function ActivityFeed({ items, now = new Date() }: { items: ActivityItem[]; now?: Date }) {
  if (items.length === 0) {
    return <EmptyState icon={History}>Complete a quest to record your first experience.</EmptyState>;
  }
  return (
    <ol className="divide-y divide-line">
      {items.map((item) => {
        const time = (
          <time className="text-xs text-ink-faint" dateTime={item.at.toISOString()} title={item.at.toLocaleString()}>
            {relativeTime(item.at, now)}
          </time>
        );
        if (item.kind === "level") {
          const rankUp = item.fromRank !== item.toRank;
          return (
            <li key={item.id} className="flex items-center gap-3 bg-glow-soft/40 px-5 py-3">
              <ChevronsUp aria-hidden className="size-4 shrink-0 text-glow" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold uppercase tracking-[0.12em]">
                  Level up · {item.fromLevel} → {item.toLevel}
                </p>
                {rankUp ? <p className="text-xs text-arcane">Promoted to {rankLabel(item.toRank)}</p> : null}
              </div>
              {time}
            </li>
          );
        }
        const Icon = XP_ICON[item.eventType];
        return (
          <li key={item.id} className="flex items-center gap-3 px-5 py-3 text-sm">
            <Icon aria-hidden className="size-4 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <p className="truncate">{item.reason}</p>
              {time}
            </div>
            <span className={cn("shrink-0 font-mono", item.amount > 0 ? "text-glow" : "text-ink-faint")}>
              +{item.amount} XP
            </span>
          </li>
        );
      })}
    </ol>
  );
}
