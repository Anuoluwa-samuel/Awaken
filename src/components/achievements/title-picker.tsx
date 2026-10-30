"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { equipTitleAction } from "@/app/system/achievements/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function TitlePicker({ titles, equipped }: { titles: { title: string; source: string }[]; equipped: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const equip = (title: string | null) =>
    startTransition(async () => {
      setError(null);
      const r = await equipTitleAction(title);
      if (!r.ok) setError(r.error);
    });

  return (
    <div className="grid gap-2 p-5">
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <ul className="grid gap-2">
        {titles.map((t) => {
          const on = t.title === equipped;
          return (
            <li
              key={t.title}
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
                on ? "border-arcane/60 bg-arcane-soft" : "border-line bg-surface/60",
              )}
            >
              <span className={cn("font-display font-semibold tracking-wide", on && "text-arcane")}>{t.title}</span>
              {on ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-arcane">
                    <Check aria-hidden className="size-3.5" /> Equipped
                  </span>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => equip(null)}>
                    Remove
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="outline" disabled={pending} onClick={() => equip(t.title)}>
                  Equip<span className="sr-only"> {t.title}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-faint">Titles are cosmetic — equipping one changes nothing about your progress.</p>
    </div>
  );
}
