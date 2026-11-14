"use client";

import { useState, useTransition } from "react";
import {
  createPoolQuestAction,
  setPoolQuestActiveAction,
  updatePoolQuestAction,
  type PoolActionResult,
} from "@/app/admin/quests/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_INFO, DIFFICULTIES } from "@/lib/progression/config";
import type { PoolQuestInput } from "@/lib/validation/quest";

const EMPTY: PoolQuestInput = { title: "", description: "", category: CATEGORIES[0], difficulty: "normal", estimatedMinutes: 20 };

/** Create (no `id`) or edit (with `id`) a daily pool quest. */
export function PoolQuestForm({ id, initial = EMPTY, onDone }: { id?: string; initial?: PoolQuestInput; onDone?: () => void }) {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<PoolActionResult | null>(null);
  const [pending, start] = useTransition();
  const prefix = id ? `edit-${id.slice(0, 8)}` : "new";
  const set = <K extends keyof PoolQuestInput>(k: K, v: PoolQuestInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = id ? await updatePoolQuestAction({ id, ...form }) : await createPoolQuestAction(form);
          setResult(r);
          if (r.ok) {
            if (!id) setForm(EMPTY);
            onDone?.();
          }
        });
      }}
    >
      <Field id={`${prefix}-title`} label="Title" className="sm:col-span-2">
        <Input id={`${prefix}-title`} value={form.title} onChange={(e) => set("title", e.target.value)} required minLength={3} />
      </Field>
      <Field id={`${prefix}-desc`} label="Description" className="sm:col-span-2">
        <Input id={`${prefix}-desc`} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Field id={`${prefix}-cat`} label="Category">
        <Select id={`${prefix}-cat`} value={form.category} onChange={(e) => set("category", e.target.value as PoolQuestInput["category"])}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_INFO[c].label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${prefix}-diff`} label="Difficulty">
        <Select
          id={`${prefix}-diff`}
          value={form.difficulty}
          onChange={(e) => set("difficulty", e.target.value as PoolQuestInput["difficulty"])}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
      <Field id={`${prefix}-min`} label="Minutes (optional)">
        <Input
          id={`${prefix}-min`}
          type="number"
          min={1}
          max={240}
          value={form.estimatedMinutes ?? ""}
          onChange={(e) => set("estimatedMinutes", e.target.value ? Number(e.target.value) : null)}
        />
      </Field>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save" : "Add to pool"}
        </Button>
        {onDone && id ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
      {result && !result.ok ? (
        <div className="sm:col-span-2">
          <FormMessage tone="error">{result.error}</FormMessage>
        </div>
      ) : result?.ok && !id ? (
        <div className="sm:col-span-2">
          <FormMessage tone="success">Added. It joins the daily rotation from the next quest day.</FormMessage>
        </div>
      ) : null}
    </form>
  );
}

export function PoolRowActions({
  id,
  active,
  editable,
  initial,
}: {
  id: string;
  active: boolean;
  editable: boolean;
  initial: PoolQuestInput;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {editable ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={active ? "danger" : "outline"}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setPoolQuestActiveAction({ id, active: !active });
              setError(r.ok ? null : r.error);
            })
          }
        >
          {active ? "Retire" : "Reactivate"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="max-w-56 text-right text-xs text-danger">
          {error}
        </p>
      ) : null}
      {editing ? (
        <div className="mt-2 w-full min-w-72 rounded-md border border-line bg-surface p-3 text-left">
          <PoolQuestForm id={id} initial={initial} onDone={() => setEditing(false)} />
        </div>
      ) : null}
    </div>
  );
}
