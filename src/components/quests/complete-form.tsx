"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { QUEST_LIMITS } from "@/lib/progression/config";
import { QuestActions } from "./quest-actions";

export function CompleteForm({
  questId,
  status,
  title,
}: {
  questId: string;
  status: "available" | "in_progress";
  title: string;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-4">
      <Field
        id="evidence"
        label="Completion note (optional)"
        hint="What did you do? This is your own record — it isn't verified."
      >
        <textarea
          id="evidence"
          rows={3}
          maxLength={QUEST_LIMITS.maxEvidenceLength}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus-visible:border-glow focus-visible:shadow-glow focus-visible:outline-none"
          placeholder="e.g. 5 km run, chapter 3 of the course…"
        />
      </Field>
      <QuestActions questId={questId} status={status} title={title} evidenceNote={note || undefined} />
    </div>
  );
}
