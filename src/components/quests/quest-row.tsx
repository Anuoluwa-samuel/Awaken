import { CheckCircle2, Circle, Clock, XCircle, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { playerQuest } from "@/db/schema";
import { ATTRIBUTE_INFO, CATEGORY_INFO } from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";
import { SwipeArea } from "./swipe-area";

type Quest = typeof playerQuest.$inferSelect;

const STATUS = {
  available: { icon: Circle, label: "Available", tone: "text-ink-muted" },
  in_progress: { icon: Clock, label: "In progress", tone: "text-glow" },
  completed: { icon: CheckCircle2, label: "Completed", tone: "text-success" },
  expired: { icon: XCircle, label: "Expired", tone: "text-ink-faint" },
  cancelled: { icon: XCircle, label: "Cancelled", tone: "text-ink-faint" },
} as const;

/**
 * One quest. Difficulty sets the card's edge treatment (see .quest-card in globals.css), so a day's
 * list reads like a mission board. Open quests with actions can also be swiped on touch screens.
 */
export function QuestRow({
  quest,
  compact = false,
  actions,
}: {
  quest: Quest;
  compact?: boolean;
  actions?: ReactNode;
}) {
  const s = STATUS[quest.status];
  const done = quest.status === "completed";
  const open = quest.status === "available" || quest.status === "in_progress";
  const content = (
    <div className="flex flex-wrap items-start gap-3 px-5 py-3.5 sm:flex-nowrap">
      <s.icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", s.tone)} />
      <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-0">
        <p className={cn("font-medium", done && "text-ink-muted line-through decoration-ink-faint")}>
          <Link href={`/system/quests/${quest.id}`} className="hover:text-glow hover:underline">
            {quest.title}
          </Link>
          <span className="sr-only"> — {s.label}</span>
        </p>
        {!compact && quest.description ? <p className="mt-0.5 text-sm text-ink-muted">{quest.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {quest.isEvent ? (
            <Badge tone="success">
              <Zap aria-hidden className="size-3" /> System event · 2× XP
            </Badge>
          ) : null}
          <Badge tone="muted">{CATEGORY_INFO[quest.category].label}</Badge>
          <span data-difficulty={quest.difficulty} className="difficulty-tag">
            {quest.difficulty}
          </span>
          {!compact ? <Badge tone="frost">+{ATTRIBUTE_INFO[quest.attribute].short}</Badge> : null}
          {quest.status === "in_progress" ? <Badge tone="glow">In progress</Badge> : null}
          {quest.kind === "custom" ? <Badge tone="muted">Custom</Badge> : null}
          {quest.estimatedMinutes ? (
            <span className="text-xs text-ink-faint">~{quest.estimatedMinutes} min</span>
          ) : null}
          {quest.dueAt && quest.kind === "custom" && !quest.templateId ? (
            <span className="text-xs text-ink-faint">due {quest.dueAt.toLocaleDateString()}</span>
          ) : null}
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 pl-8 sm:w-auto sm:flex-col sm:items-end sm:justify-start sm:pl-0">
        <span className={cn("whitespace-nowrap font-mono text-sm font-semibold", done ? "text-success" : quest.isEvent ? "text-success" : "text-glow")}>
          +{quest.xpReward} XP
        </span>
        {actions}
      </div>
    </div>
  );
  return (
    <li data-difficulty={quest.difficulty} data-event={quest.isEvent || undefined} data-status={quest.status} className="quest-card">
      {open && actions ? (
        <SwipeArea questId={quest.id} title={quest.title}>
          {content}
        </SwipeArea>
      ) : (
        content
      )}
    </li>
  );
}
