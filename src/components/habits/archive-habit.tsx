"use client";

import { Archive } from "lucide-react";
import { useState, useTransition } from "react";
import { archiveHabitAction } from "@/app/system/habits/actions";
import { Button } from "@/components/ui/button";

export function ArchiveHabit({ habitId, name }: { habitId: string; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
      {confirm ? (
        <>
          <span className="text-xs text-ink-muted">Archive? History and XP are kept.</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Keep
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await archiveHabitAction(habitId);
                if (!r.ok) setError(r.error);
              })
            }
          >
            Archive<span className="sr-only"> {name}</span>
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
          <Archive aria-hidden />
          Archive<span className="sr-only"> {name}</span>
        </Button>
      )}
    </div>
  );
}
