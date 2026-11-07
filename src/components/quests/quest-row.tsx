import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { playerQuest } from "@/db/schema";
import { ATTRIBUTE_INFO, CATEGORY_INFO } from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";

type Quest = typeof playerQuest.$inferSelect;

const STATUS = {
  available: { icon: Circle, label: "Available", tone: "text-ink-muted" },
  in_progress: { icon: Clock, label: "In progress", tone: "text-glow" },
  completed: { icon: CheckCircle2, label: "Completed", tone: "text-success" },
  expired: { icon: XCircle, label: "Expired", tone: "text-ink-faint" },
  cancelled: { icon: XCircle, label: "Cancelled", tone: "text-ink-faint" },
} as const;

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
  return (
    <li className="flex flex-wrap items-start gap-3 px-5 py-3.5 sm:flex-nowrap">
      <s.icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", s.tone)} />
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", done && "text-ink-muted line-through decoration-ink-faint")}>
          <Link href={`/system/quests/${quest.id}`} className="hover:text-glow hover:underline">
            {quest.title}
          </Link>
          <span className="sr-only"> — {s.label}</span>
        </p>
        {!compact && quest.description ? <p className="mt-0.5 text-sm text-ink-muted">{quest.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="muted">{CATEGORY_INFO[quest.category].label}</Badge>
          <Badge tone="muted">{quest.difficulty}</Badge>
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
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={cn("font-mono text-sm font-semibold", done ? "text-success" : "text-glow")}>
          +{quest.xpReward} XP
        </span>
        {actions}
      </div>
    </li>
  );
}
