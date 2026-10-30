"use client";

import { CheckCircle2, Circle, Link2, ScrollText } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { completeMilestoneAction, createQuestForMilestoneAction } from "@/app/system/goals/actions";
import { useShowCompletion, useShowLevelUp } from "@/components/quests/completion-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function MilestoneRow({
  milestone,
  active,
}: {
  milestone: {
    id: string;
    title: string;
    completedAt: Date | null;
    quest: { id: string; title: string; status: string } | null;
  };
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const showCompletion = useShowCompletion();
  const showLevelUp = useShowLevelUp();
  const done = !!milestone.completedAt;
  const questOpen = milestone.quest && (milestone.quest.status === "available" || milestone.quest.status === "in_progress");

  return (
    <li className="flex flex-wrap items-start gap-3 py-2.5">
      <button
        type="button"
        disabled={!active || done || pending}
        aria-label={done ? `${milestone.title} — done` : `Mark “${milestone.title}” done`}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const r = await completeMilestoneAction(milestone.id);
            if (!r.ok) return setMessage({ tone: "error", text: r.error });
            const d = r.data;
            if (d.quest) showCompletion(d.quest);
            if (d.goalCompleted) {
              if (!d.quest && d.goalCompleted.levelChange) showLevelUp(d.goalCompleted.levelChange);
              setMessage({
                tone: "ok",
                text: [
                  `Goal complete: ${d.goalCompleted.title}.`,
                  d.goalCompleted.xp.granted ? `+${d.goalCompleted.xp.granted} XP` : null,
                  d.goalCompleted.xp.note,
                  d.goalCompleted.achievements.length ? `Achievement: ${d.goalCompleted.achievements.map((a) => a.name).join(", ")}.` : null,
                ]
                  .filter(Boolean)
                  .join(" "),
              });
            }
          })
        }
        className={cn("mt-0.5 rounded-full disabled:cursor-default", !done && active && "hover:text-glow")}
      >
        {done ? <CheckCircle2 aria-hidden className="size-5 text-success" /> : <Circle aria-hidden className="size-5 text-ink-muted" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", done && "text-ink-muted line-through decoration-ink-faint")}>{milestone.title}</p>
        {milestone.quest ? (
          <Link
            href={`/system/quests/${milestone.quest.id}`}
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-glow hover:underline"
          >
            <Link2 aria-hidden className="size-3" /> Linked quest{questOpen ? "" : ` · ${milestone.quest.status.replace("_", " ")}`}
          </Link>
        ) : null}
        {message ? (
          <p role={message.tone === "error" ? "alert" : "status"} className={cn("mt-1 text-xs", message.tone === "error" ? "text-danger" : "text-success")}>
            {message.text}
          </p>
        ) : null}
      </div>
      {active && !done && !milestone.quest ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          title="Create a one-off quest for this milestone. Completing either completes both."
          onClick={() =>
            startTransition(async () => {
              const r = await createQuestForMilestoneAction(milestone.id);
              setMessage(r.ok ? { tone: "ok", text: "Quest created and linked." } : { tone: "error", text: r.error });
            })
          }
        >
          <ScrollText aria-hidden /> Make quest
        </Button>
      ) : null}
    </li>
  );
}
