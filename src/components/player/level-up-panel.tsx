"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RANKS } from "@/lib/progression/config";
import type { ProgressionChange } from "@/lib/progression/rewards";
import { RankEmblem } from "./rank-emblem";

export const LEVEL_UP_AUTO_CLOSE_MS = 6000;

/**
 * Celebration for a level-up. Non-modal on purpose: the page stays interactive behind it,
 * it doesn't take focus, and it closes on Escape, "Continue", or after a few seconds.
 */
export function LevelUpPanel({ change, onClose }: { change: ProgressionChange; onClose: () => void }) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current(), LEVEL_UP_AUTO_CLOSE_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toRank = RANKS.find((r) => r.id === change.toRank)!;
  const rewards = [
    `${change.skillPointsGained} skill point${change.skillPointsGained === 1 ? "" : "s"}`,
    ...(change.rankChanged ? [`Promotion to ${toRank.label}`] : []),
  ];

  return (
    <div className="levelup" role="status" aria-live="polite">
      <div className="levelup-backdrop" aria-hidden />
      <section className="levelup-panel" aria-label="Level up">
        <div className="levelup-rings" aria-hidden>
          <span />
          <span />
        </div>
        <p className="levelup-eyebrow">System message</p>
        <h2 className="levelup-title">Level up</h2>
        <p className="levelup-levels">
          <span className="text-ink-muted">Lv {change.fromLevel}</span>
          <span aria-hidden className="levelup-arrow">
            →
          </span>
          <span className="levelup-new">Lv {change.toLevel}</span>
        </p>
        {change.levelsGained > 1 ? (
          <p className="text-sm text-ink-muted">{change.levelsGained} levels gained at once</p>
        ) : null}

        {change.rankChanged ? (
          <div className="levelup-rank">
            <RankEmblem rank={change.fromRank} className="size-10 opacity-60" />
            <span aria-hidden className="text-ink-faint">
              →
            </span>
            <RankEmblem rank={change.toRank} className="size-14" />
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-ink">
              Rank up · {toRank.label}
            </p>
          </div>
        ) : null}

        <div className="mt-5 w-full border-t border-line pt-4 text-left">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faint">
            Rewards unlocked
          </p>
          <ul className="mt-2 grid gap-1 text-sm">
            {rewards.map((r) => (
              <li key={r} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rotate-45 bg-success" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <Button className="mt-5 w-full" variant="outline" onClick={onClose}>
          Continue
        </Button>
      </section>
    </div>
  );
}
