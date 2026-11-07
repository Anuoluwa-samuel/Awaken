"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { AchievementIcon } from "@/components/achievements/achievement-icon";
import { ATTRIBUTE_INFO, type Attribute } from "@/lib/progression/config";
import type { CompletionResult } from "@/server/services/quests";

/** Non-blocking system message shown after completing a quest. */
export function CompletionPanel({ result, onClose }: { result: CompletionResult; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, result.levelChange ? 9000 : 6000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, result.levelChange]);

  const done = result.status === "completed";
  // The quest's own attribute and the daily Discipline bonus can be the same attribute.
  const totals = new Map<Attribute, number>();
  for (const a of result.attributes) if (a.granted > 0) totals.set(a.attribute, (totals.get(a.attribute) ?? 0) + a.granted);
  const attributeGains = [...totals];
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm animate-rise rounded-lg border border-line-strong bg-panel/95 p-4 shadow-[var(--shadow-panel),var(--shadow-glow)] backdrop-blur lg:bottom-6 lg:left-auto lg:right-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-ink-faint hover:text-ink"
      >
        <X className="size-4" />
      </button>
      <p className={`font-display text-[11px] font-semibold uppercase tracking-[0.3em] ${done ? "text-success" : "text-glow"}`}>
        {done ? "Quest completed" : "Already completed"}
      </p>
      <p className="mt-1 pr-6 font-medium">{result.questTitle}</p>
      {done ? (
        <>
          <p className="mt-2 font-display text-sm uppercase tracking-[0.15em] text-ink-muted">
            Experience acquired{" "}
            <span className="ml-1 font-mono text-base tracking-normal text-glow">+{result.xp.granted} XP</span>
          </p>
          {attributeGains.length > 0 ? (
            <p className="mt-1 text-sm text-frost">
              {attributeGains.map(([attribute, n]) => `+${n} ${ATTRIBUTE_INFO[attribute].short}`).join(" · ")}
            </p>
          ) : null}
          {result.xp.note ? <p className="mt-2 text-xs text-warning">{result.xp.note}</p> : null}
          {result.weekly
            .filter((w) => w.completed && w.xpGranted > 0)
            .map((w) => (
              <p key={w.challengeId} className="mt-2 text-sm text-success">
                Weekly challenge complete: {w.title} · +{w.xpGranted} XP
              </p>
            ))}
          {result.achievements.map((a) => (
            <div key={a.code} className="mt-2 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2">
              <AchievementIcon name={a.icon} className="size-4 shrink-0 text-success" />
              <p className="text-sm">
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-success">
                  Achievement unlocked
                </span>{" "}
                {a.name}
                {a.xpReward ? <span className="font-mono text-glow"> +{a.xpReward} XP</span> : null}
                {a.titleReward ? <span className="text-success"> · Title: {a.titleReward}</span> : null}
              </p>
            </div>
          ))}
          {result.levelChange ? (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-success/50 bg-success/10 px-3 py-2 shadow-[0_0_18px_-6px_#b6ff4a99]">
              <Sparkles aria-hidden className="size-4 text-success" />
              <p className="font-display text-sm font-semibold uppercase tracking-[0.15em]">
                Level up · {result.levelChange.fromLevel} → {result.levelChange.toLevel}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">{result.xp.note}</p>
      )}
    </div>
  );
}
