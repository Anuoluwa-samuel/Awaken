"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { StreakFlame } from "@/components/player/streak-flame";
import type { BootSummary } from "@/server/services/boot";

const key = (day: string) => `awaken:boot:${day}`;
const noop = () => () => {};

function seenToday(day: string) {
  try {
    return localStorage.getItem(key(day)) === "1";
  } catch {
    return true; // storage blocked: don't show it on every page load
  }
}

/**
 * Once per quest day, the System "boots" with a short briefing: yesterday's XP, the streak, and
 * today's orders. Shown on the first visit of the day only; any key, click or "Begin" dismisses it.
 */
export function BootScreen({ boot, streak, name }: { boot: BootSummary; streak: number; name: string }) {
  // Server render and hydration both say "seen", so the overlay only appears after mount.
  const seen = useSyncExternalStore(noop, () => seenToday(boot.today), () => true);
  const [closed, setClosed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const open = !boot.firstDay && !seen && !closed;

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(key(boot.today), "1");
    } catch {
      /* ignore */
    }
    button.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setClosed(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, boot.today]);

  if (!open) return null;
  const lines = [
    `Player ${name} identified.`,
    boot.yesterdayXp > 0 ? `Yesterday: +${boot.yesterdayXp} XP acquired.` : "Yesterday: no experience recorded.",
    boot.questsToday > 0 ? `${boot.questsToday} daily quest${boot.questsToday === 1 ? "" : "s"} issued.` : "No daily quests today.",
  ];
  return (
    <div className="boot" role="dialog" aria-modal="true" aria-labelledby="boot-title" onClick={() => setClosed(true)}>
      <div className="boot-scan" aria-hidden />
      <section className="boot-body" onClick={(e) => e.stopPropagation()}>
        <p className="boot-eyebrow">System boot · {boot.today}</p>
        <h2 id="boot-title" className="mt-3 font-display text-2xl font-bold uppercase tracking-[0.12em]">
          Welcome back
        </h2>
        <ul className="mt-5 grid gap-1.5 text-left font-mono text-sm text-ink-muted">
          {lines.map((l, i) => (
            <li key={l} className="boot-line" style={{ animationDelay: `${300 + i * 350}ms` }}>
              <span aria-hidden className="text-glow">› </span>
              {l}
            </li>
          ))}
          <li className="boot-line flex items-center gap-2" style={{ animationDelay: `${300 + lines.length * 350}ms` }}>
            <span aria-hidden className="text-glow">›</span> Streak: <StreakFlame streak={streak} size="sm" />
          </li>
          {boot.eventTitle ? (
            <li className="boot-line text-success" style={{ animationDelay: `${300 + (lines.length + 1) * 350}ms` }}>
              <span aria-hidden>! </span>System event detected: {boot.eventTitle} (2× XP)
            </li>
          ) : null}
        </ul>
        <Button ref={button} className="boot-line mt-7 w-full" style={{ animationDelay: "1900ms" }} onClick={() => setClosed(true)}>
          Begin the day
        </Button>
      </section>
    </div>
  );
}
