"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { saveSettings } from "@/app/system/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_INFO, DIFFICULTIES, DIFFICULTY_XP } from "@/lib/progression/config";
import { settingsSchema, type SettingsInput } from "@/lib/validation/player";

export function SettingsForm({ defaults }: { defaults: SettingsInput }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const timeZones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    return all.includes(defaults.timeZone) ? all : [defaults.timeZone, ...all];
  }, [defaults.timeZone]);
  const form = useForm({ resolver: zodResolver(settingsSchema), defaultValues: defaults });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveSettings(values);
      setMessage(result.ok ? { tone: "success", text: "Player status updated." } : { tone: "error", text: result.error });
      if (result.ok) form.reset(values);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Field id="displayName" label="Display name" error={errors.displayName?.message}>
        <Input id="displayName" aria-invalid={!!errors.displayName} {...form.register("displayName")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="timeZone" label="Time zone" hint="Can be changed once every 7 days.">
          <Select id="timeZone" {...form.register("timeZone")}>
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="dayStartHour" label="New day begins at">
          <Select id="dayStartHour" {...form.register("dayStartHour", { valueAsNumber: true })}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </Field>
        <Field id="preferredDifficulty" label="Preferred difficulty">
          <Select id="preferredDifficulty" {...form.register("preferredDifficulty")}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d[0].toUpperCase() + d.slice(1)} · {DIFFICULTY_XP[d]} XP
              </option>
            ))}
          </Select>
        </Field>
        <Field id="dailyTarget" label="Daily quest target" error={errors.dailyTarget?.message}>
          <Input
            id="dailyTarget"
            type="number"
            min={1}
            max={20}
            placeholder="No target"
            {...form.register("dailyTarget", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}
          />
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Development areas
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" value={c} className="size-4 accent-[#4f9dff]" {...form.register("focusAreas")} />
              {CATEGORY_INFO[c].label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm text-ink-muted">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[#4f9dff]" {...form.register("showOnLeaderboard")} />
        <span>
          Show me on the global leaderboard. Other players see your display name, title, level, rank and XP, never your
          email.
        </span>
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !form.formState.isDirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
