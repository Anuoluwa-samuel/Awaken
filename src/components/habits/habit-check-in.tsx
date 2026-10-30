"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { checkInHabitAction } from "@/app/system/habits/actions";
import { useShowCompletion, useShowLevelUp } from "@/components/quests/completion-provider";
import { Button } from "@/components/ui/button";
import { ATTRIBUTE_INFO } from "@/lib/progression/config";

export function HabitCheckIn({
  habitId,
  name,
  doneToday,
  restDay,
}: {
  habitId: string;
  name: string;
  doneToday: boolean;
  /** Not due today (rest day, or weekly target already met): still recordable. */
  restDay: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const showCompletion = useShowCompletion();
  const showLevelUp = useShowLevelUp();

  if (doneToday) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.1em] text-success">
          <Check aria-hidden className="size-4" /> Done today
        </span>
        {message ? (
          <p role="status" className="max-w-56 text-right text-xs text-ink-muted">
            {message.text}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={restDay ? "outline" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const r = await checkInHabitAction(habitId);
            if (!r.ok) return setMessage({ tone: "error", text: r.error });
            const d = r.data;
            if (d.status === "already_checked_in") return setMessage({ tone: "ok", text: "Already checked in today." });
            if (d.quest) showCompletion(d.quest);
            else if (d.levelChange) showLevelUp(d.levelChange);
            const gains = [
              d.xp.granted > 0 ? `+${d.xp.granted} XP` : null,
              ...d.attributes.filter((a) => a.granted > 0).map((a) => `+${a.granted} ${ATTRIBUTE_INFO[a.attribute].short}`),
            ].filter(Boolean);
            setMessage({
              tone: "ok",
              text: [d.via === "quest" ? "Linked quest completed." : null, gains.join(" · ") || null, d.xp.note]
                .filter(Boolean)
                .join(" "),
            });
          })
        }
      >
        <Check aria-hidden />
        {pending ? "…" : restDay ? "Check in anyway" : "Check in"}
        <span className="sr-only"> {name}</span>
      </Button>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`max-w-56 text-right text-xs ${message.tone === "error" ? "text-danger" : "text-ink-muted"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
