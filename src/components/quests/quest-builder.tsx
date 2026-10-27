"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createCustomQuestAction } from "@/app/system/quests/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import {
  ATTRIBUTE_INFO,
  ATTRIBUTES,
  CATEGORIES,
  CATEGORY_INFO,
  DIFFICULTIES,
  LIMITS,
  QUEST_LIMITS,
  type Difficulty,
} from "@/lib/progression/config";
import { customXpBounds, resolveQuestXp } from "@/lib/progression/rewards";
import { cn } from "@/lib/utils/cn";
import { customQuestSchema, type CustomQuestInput } from "@/lib/validation/quest";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const textareaClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-glow focus-visible:shadow-glow focus-visible:outline-none";
const nullableNumber = (v: unknown) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

export function QuestBuilder({ defaultDifficulty, today }: { defaultDifficulty: Difficulty; today: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checklistText, setChecklistText] = useState("");

  const form = useForm<CustomQuestInput>({
    resolver: zodResolver(customQuestSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "learning",
      difficulty: defaultDifficulty,
      attribute: null,
      xpReward: null,
      scheduleType: "once",
      targetDate: null,
      days: [1, 2, 3, 4, 5],
      estimatedMinutes: null,
      checklist: [],
    },
  });
  const { errors } = form.formState;
  const [difficulty, xpReward, scheduleType, days, category] = useWatch({
    control: form.control,
    name: ["difficulty", "xpReward", "scheduleType", "days", "category"],
  });
  const bounds = customXpBounds(difficulty);
  const resolved = resolveQuestXp(difficulty, xpReward);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const checklist = checklistText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, QUEST_LIMITS.maxChecklistItems);
      const result = await createCustomQuestAction({ ...values, checklist });
      // Success redirects; we only get here on failure.
      if (result && !result.ok) setError(result.error);
    }),
  );

  const toggleDay = (d: number) =>
    form.setValue("days", days.includes(d) ? days.filter((x) => x !== d) : [...days, d], { shouldValidate: true });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <Field id="title" label="Title" error={errors.title?.message}>
        <Input id="title" maxLength={QUEST_LIMITS.maxTitleLength} aria-invalid={!!errors.title} {...form.register("title")} />
      </Field>
      <Field id="description" label="Description (optional)" error={errors.description?.message}>
        <textarea
          id="description"
          rows={2}
          maxLength={QUEST_LIMITS.maxDescriptionLength}
          className={textareaClass}
          {...form.register("description")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="category" label="Category">
          <Select id="category" {...form.register("category")}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="difficulty" label="Difficulty">
          <Select id="difficulty" {...form.register("difficulty")}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d[0].toUpperCase() + d.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="attribute" label="Attribute focus">
          <Select
            id="attribute"
            {...form.register("attribute", { setValueAs: (v) => (v === "" ? null : v) })}
          >
            <option value="">Auto · {ATTRIBUTE_INFO[CATEGORY_INFO[category].attribute].label}</option>
            {ATTRIBUTES.map((a) => (
              <option key={a} value={a}>
                {ATTRIBUTE_INFO[a].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="xpReward"
          label="Custom XP (optional)"
          hint={`Allowed ${bounds.min}–${bounds.max} for this difficulty. Values outside are clamped.`}
        >
          <Input
            id="xpReward"
            type="number"
            inputMode="numeric"
            placeholder="Use default"
            {...form.register("xpReward", { setValueAs: nullableNumber })}
          />
        </Field>
        <Field id="estimatedMinutes" label="Estimated minutes (optional)" error={errors.estimatedMinutes?.message}>
          <Input
            id="estimatedMinutes"
            type="number"
            min={1}
            max={600}
            {...form.register("estimatedMinutes", { setValueAs: nullableNumber })}
          />
        </Field>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Schedule
        </legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" value="once" className="accent-[#4f9dff]" {...form.register("scheduleType")} />
            One-time
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="recurring" className="accent-[#4f9dff]" {...form.register("scheduleType")} />
            Recurring
          </label>
        </div>
        {scheduleType === "once" ? (
          <Field id="targetDate" label="Target date (optional)" hint="The quest expires after this day.">
            <Input
              id="targetDate"
              type="date"
              min={today}
              className="sm:max-w-56"
              {...form.register("targetDate", { setValueAs: (v) => (v ? v : null) })}
            />
          </Field>
        ) : (
          <div>
            <div role="group" aria-label="Days of the week" className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={days.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "h-9 w-12 rounded-md border text-sm",
                    days.includes(d)
                      ? "border-glow bg-glow-soft text-ink"
                      : "border-line text-ink-muted hover:border-line-strong",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.days ? (
              <p role="alert" className="mt-1 text-xs text-danger">
                {errors.days.message}
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-faint">Days not selected are rest days. Rewarded once per day.</p>
            )}
          </div>
        )}
      </fieldset>

      <Field id="checklist" label="Checklist (optional)" hint={`One step per line, up to ${QUEST_LIMITS.maxChecklistItems}.`}>
        <textarea
          id="checklist"
          rows={3}
          className={textareaClass}
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
        />
      </Field>

      <div className="rounded-md border border-line bg-surface/70 p-4 text-sm">
        <p>
          Reward: <span className="font-mono font-semibold text-glow">+{resolved} XP</span> per completion, fixed when
          the quest is created.
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Completion is self-reported. Custom quests earn XP for up to {LIMITS.customCompletionsPerCategoryPerDay}{" "}
          completions per category per day; further completions are recorded without XP.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button asChild variant="ghost">
          <Link href="/system/quests">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          <Plus aria-hidden />
          {pending ? "Registering…" : "Create quest"}
        </Button>
      </div>
    </form>
  );
}
