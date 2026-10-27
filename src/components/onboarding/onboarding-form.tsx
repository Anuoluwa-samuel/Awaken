"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { completeOnboarding } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import {
  CATEGORIES,
  CATEGORY_INFO,
  DEFAULT_DAY_START_HOUR,
  DIFFICULTIES,
  DIFFICULTY_XP,
  type Category,
} from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/player";

function formatHour(h: number) {
  return new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString([], { hour: "numeric", timeZone: "UTC" });
}

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const timeZones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const form = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      displayName: defaultName.slice(0, 32),
      timeZone: "UTC",
      dayStartHour: DEFAULT_DAY_START_HOUR,
      focusAreas: [] as Category[],
      preferredDifficulty: "normal" as const,
      dailyTarget: null as number | null,
    },
  });
  const { errors } = form.formState;
  const focusAreas = useWatch({ control: form.control, name: "focusAreas" });

  // The browser knows the player's zone; the server never guesses from its own clock.
  useEffect(() => {
    form.setValue("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, [form]);

  const submit = (values: OnboardingInput) =>
    startTransition(async () => {
      setError(null);
      const result = await completeOnboarding(values);
      if (result?.error) setError(result.error);
    });

  const toggleArea = (c: Category) =>
    form.setValue(
      "focusAreas",
      focusAreas.includes(c) ? focusAreas.filter((x) => x !== c) : [...focusAreas, c],
      { shouldDirty: true },
    );

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="mt-8 grid gap-6">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <Panel className="grid gap-5 p-5 sm:p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">Identity</h2>
        <Field id="displayName" label="Display name" error={errors.displayName?.message}>
          <Input id="displayName" aria-invalid={!!errors.displayName} {...form.register("displayName")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="timeZone" label="Time zone" hint="Decides when your day resets." error={errors.timeZone?.message}>
            <Select id="timeZone" {...form.register("timeZone")}>
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="dayStartHour" label="New day begins at" hint="Late nights count toward the previous day.">
            <Select id="dayStartHour" {...form.register("dayStartHour", { valueAsNumber: true })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel className="grid gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink-muted">
            Development areas
          </h2>
          <p className="mt-1 text-sm text-ink-faint">Pick any. Your starter quests come from these.</p>
        </div>
        <fieldset>
          <legend className="sr-only">Development areas</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => {
              const selected = focusAreas.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleArea(c)}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "border-glow bg-glow-soft text-ink shadow-glow"
                      : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {CATEGORY_INFO[c].label}
                  <Check aria-hidden className={cn("size-4 text-glow", !selected && "invisible")} />
                </button>
              );
            })}
          </div>
        </fieldset>
      </Panel>

      <Panel className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Field id="preferredDifficulty" label="Preferred quest difficulty" hint="Default for quests you create.">
          <Select id="preferredDifficulty" {...form.register("preferredDifficulty")}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d[0].toUpperCase() + d.slice(1)} · {DIFFICULTY_XP[d]} XP
              </option>
            ))}
          </Select>
        </Field>
        <Field id="dailyTarget" label="Daily quest target (optional)" hint="How many daily quests you want, 1–20." error={errors.dailyTarget?.message}>
          <Input
            id="dailyTarget"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            placeholder="No target"
            aria-invalid={!!errors.dailyTarget}
            {...form.register("dailyTarget", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
            })}
          />
        </Field>
      </Panel>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            submit({
              ...form.getValues(),
              focusAreas: [],
              dailyTarget: null,
              preferredDifficulty: "normal",
              dayStartHour: DEFAULT_DAY_START_HOUR,
            })
          }
        >
          Skip — use defaults
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating character…" : "Create character"}
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
