"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createHabitAction } from "@/app/system/habits/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { ATTRIBUTE_INFO, ATTRIBUTES, CATEGORIES, CATEGORY_INFO, HABIT_RULES, type Category } from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";
import { habitSchema, type HabitInput } from "@/lib/validation/habit";

const DAYS = [
  { d: 1, label: "Mon" },
  { d: 2, label: "Tue" },
  { d: 3, label: "Wed" },
  { d: 4, label: "Thu" },
  { d: 5, label: "Fri" },
  { d: 6, label: "Sat" },
  { d: 0, label: "Sun" },
];

export function HabitForm({ linkable }: { linkable: { id: string; title: string; category: Category }[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<HabitInput>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "wellbeing",
      attribute: null,
      scheduleType: "days",
      days: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 3,
      linkedTemplateId: null,
    },
  });
  const { errors } = form.formState;
  const [scheduleType, days, category, linkedTemplateId] = useWatch({
    control: form.control,
    name: ["scheduleType", "days", "category", "linkedTemplateId"],
  });

  const toggleDay = (d: number) =>
    form.setValue("days", days.includes(d) ? days.filter((x) => x !== d) : [...days, d], { shouldValidate: true });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const r = await createHabitAction(values);
      if (r && !r.ok) setError(r.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Field id="name" label="Habit" error={errors.name?.message}>
        <Input id="name" maxLength={HABIT_RULES.maxNameLength} placeholder="e.g. Drink a glass of water" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="description" label="Why it matters (optional)">
        <Input id="description" maxLength={HABIT_RULES.maxDescriptionLength} {...form.register("description")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="category" label="Category">
          <Select id="category" {...form.register("category")}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_INFO[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="attribute" label="Attribute focus">
          <Select id="attribute" {...form.register("attribute", { setValueAs: (v) => (v === "" ? null : v) })}>
            <option value="">Auto · {ATTRIBUTE_INFO[CATEGORY_INFO[category].attribute].label}</option>
            {ATTRIBUTES.map((a) => (
              <option key={a} value={a}>
                {ATTRIBUTE_INFO[a].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Schedule</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" value="days" className="accent-[#4f9dff]" {...form.register("scheduleType")} />
            Specific days
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="weekly" className="accent-[#4f9dff]" {...form.register("scheduleType")} />
            Times per week
          </label>
        </div>
        {scheduleType === "days" ? (
          <div>
            <div role="group" aria-label="Days of the week" className="flex flex-wrap gap-1.5">
              {DAYS.map(({ d, label }) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "h-9 w-12 rounded-md border text-sm",
                    days.includes(d) ? "border-glow bg-glow-soft text-ink" : "border-line text-ink-muted hover:border-line-strong",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={cn("mt-1 text-xs", errors.days ? "text-danger" : "text-ink-faint")} role={errors.days ? "alert" : undefined}>
              {errors.days?.message ?? "Unselected days are rest days — they never break your streak."}
            </p>
          </div>
        ) : (
          <Field id="timesPerWeek" label="Times per week" hint="Any days, Monday–Sunday." error={errors.timesPerWeek?.message}>
            <Select id="timesPerWeek" className="sm:max-w-40" {...form.register("timesPerWeek", { valueAsNumber: true })}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}× per week
                </option>
              ))}
            </Select>
          </Field>
        )}
      </fieldset>

      <Field
        id="linkedTemplateId"
        label="Link to a daily quest (optional)"
        hint={
          linkedTemplateId
            ? "Checking in will complete this quest. You get the quest's rewards only — never both."
            : "Use when the habit and a daily quest are the same thing."
        }
      >
        <Select id="linkedTemplateId" {...form.register("linkedTemplateId", { setValueAs: (v) => (v ? v : null) })}>
          <option value="">Not linked</option>
          {linkable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex justify-end gap-3">
        <Button asChild variant="ghost">
          <Link href="/system/habits">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          <Plus aria-hidden />
          {pending ? "Saving…" : "Start tracking"}
        </Button>
      </div>
    </form>
  );
}
