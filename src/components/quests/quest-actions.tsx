"use client";

import { Check, Play, X } from "lucide-react";
import { useState, useTransition } from "react";
import { cancelQuestAction, completeQuestAction, startQuestAction } from "@/app/system/quests/actions";
import { Button } from "@/components/ui/button";
import { useShowCompletion } from "./completion-provider";

export function QuestActions({
  questId,
  status,
  title,
  evidenceNote,
}: {
  questId: string;
  status: "available" | "in_progress";
  title: string;
  evidenceNote?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const showCompletion = useShowCompletion();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
    });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "available" ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => startQuestAction(questId))}>
            <Play aria-hidden />
            Start<span className="sr-only"> {title}</span>
          </Button>
        ) : null}
        {confirmSkip ? (
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => run(() => cancelQuestAction(questId))}
            onBlur={() => setConfirmSkip(false)}
          >
            <X aria-hidden />
            Confirm skip<span className="sr-only"> {title}</span>
          </Button>
        ) : (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmSkip(true)}>
            Skip<span className="sr-only"> {title}</span>
          </Button>
        )}
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await completeQuestAction({ questId, evidenceNote });
              if (r.ok) showCompletion(r.data);
              return r;
            })
          }
        >
          <Check aria-hidden />
          {pending ? "…" : "Complete"}
          <span className="sr-only"> {title}</span>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="max-w-56 text-right text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
