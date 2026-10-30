"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createGoalAction } from "@/app/system/goals/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_INFO, GOAL_RULES, type Category } from "@/lib/progression/config";
import { goalRewardXp } from "@/lib/progression/goals";

export function GoalForm({ today }: { today: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("career");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<string[]>(["", "", ""]);

  const filled = milestones.map((m) => m.trim()).filter(Boolean);
  const setAt = (i: number, v: string) => setMilestones((ms) => ms.map((m, j) => (j === i ? v : m)));

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await createGoalAction({ title, description, category, deadline: deadline || null, milestones: filled });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Field id="goal-title" label="Goal">
        <Input id="goal-title" value={title} maxLength={GOAL_RULES.maxTitleLength} placeholder="e.g. Build and deploy my portfolio" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field id="goal-description" label="Why it matters (optional)">
        <Input id="goal-description" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="goal-category" label="Category">
          <Select id="goal-category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="goal-deadline" label="Deadline (optional)">
          <Input id="goal-deadline" type="date" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Milestones</legend>
        <ol className="grid gap-2">
          {milestones.map((m, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 text-right font-mono text-xs text-ink-faint">{i + 1}</span>
              <label htmlFor={`milestone-${i}`} className="sr-only">
                Milestone {i + 1}
              </label>
              <Input id={`milestone-${i}`} value={m} maxLength={GOAL_RULES.maxTitleLength} onChange={(e) => setAt(i, e.target.value)} />
              {milestones.length > 1 ? (
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove milestone ${i + 1}`} onClick={() => setMilestones((ms) => ms.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
        {milestones.length < GOAL_RULES.maxMilestones ? (
          <Button type="button" size="sm" variant="ghost" className="justify-self-start" onClick={() => setMilestones((ms) => [...ms, ""])}>
            <Plus aria-hidden /> Add milestone
          </Button>
        ) : null}
        <p className="text-xs text-ink-faint">
          {filled.length >= GOAL_RULES.minMilestones
            ? `Worth ${goalRewardXp(filled.length)} XP when completed on a later day.`
            : `Goals with at least ${GOAL_RULES.minMilestones} milestones earn XP when completed.`}{" "}
          You can link milestones to quests after creating the goal.
        </p>
      </fieldset>

      <div className="flex justify-end gap-3">
        <Button asChild variant="ghost">
          <Link href="/system/goals">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending || title.trim().length < 3 || filled.length === 0}>
          <Plus aria-hidden /> {pending ? "Saving…" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}
