"use client";

import { Archive, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { addMilestoneAction, archiveGoalAction } from "@/app/system/goals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GOAL_RULES } from "@/lib/progression/config";

export function AddMilestone({ goalId }: { goalId: string }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addMilestoneAction({ goalId, title });
          if (!r.ok) return setError(r.error);
          setError(null);
          setTitle("");
        });
      }}
    >
      <div className="flex gap-2">
        <label htmlFor={`ms-${goalId}`} className="sr-only">
          New milestone
        </label>
        <Input
          id={`ms-${goalId}`}
          className="h-8"
          placeholder="Add a milestone"
          maxLength={GOAL_RULES.maxTitleLength}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button size="sm" variant="outline" type="submit" disabled={pending || title.trim().length < 2}>
          <Plus aria-hidden /> Add
        </Button>
      </div>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </form>
  );
}

export function ArchiveGoal({ goalId, title }: { goalId: string; title: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  return confirm ? (
    <span className="flex items-center gap-2">
      <span className="text-xs text-ink-muted">Archive? History and XP are kept.</span>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(async () => void (await archiveGoalAction(goalId)))}>
        Archive<span className="sr-only"> {title}</span>
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
      <Archive aria-hidden /> Archive<span className="sr-only"> {title}</span>
    </Button>
  );
}
