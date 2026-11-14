"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RANKS } from "@/lib/progression/config";
import type { ProgressionChange } from "@/lib/progression/rewards";
import { RankEmblem } from "./rank-emblem";

/**
 * The rarest moment in the game: a new rank. Unlike the level-up panel it takes the whole screen
 * and waits for the player, since it happens only a handful of times in a lifetime.
 */
export function RankUpCeremony({ change, onClose }: { change: ProgressionChange; onClose: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    button.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  const from = RANKS.find((r) => r.id === change.fromRank)!;
  const to = RANKS.find((r) => r.id === change.toRank)!;
  const next = RANKS[RANKS.findIndex((r) => r.id === to.id) + 1];
  return (
    <div className="rankup" role="dialog" aria-modal="true" aria-labelledby="rankup-title" data-rank={to.id}>
      <div className="rankup-backdrop" aria-hidden />
      <div className="rankup-beams" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <section className="rankup-body">
        <p className="rankup-eyebrow">The System has re-evaluated you</p>
        <div className="rankup-emblem">
          <RankEmblem rank={to.id} className="size-full" />
        </div>
        <h2 id="rankup-title" className="rankup-title">
          {to.label}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {from.label} → <span className="text-success">{to.label}</span> · reached at level {change.toLevel}
        </p>
        {next ? (
          <p className="mt-1 text-xs text-ink-faint">
            Next: {next.label} at level {next.minLevel}
          </p>
        ) : (
          <p className="mt-1 text-xs text-success">There is no rank above this one.</p>
        )}
        <Button ref={button} className="mt-8 min-w-48" onClick={onClose}>
          Accept the rank
        </Button>
      </section>
    </div>
  );
}
