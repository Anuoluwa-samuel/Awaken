"use client";

import { Coffee, Pause, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  completeFocusAction,
  endFocusEarlyAction,
  pauseFocusAction,
  resumeFocusAction,
  startFocusAction,
} from "@/app/system/focus/actions";
import { useShowCompletion, useShowLevelUp } from "@/components/quests/completion-provider";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { ATTRIBUTE_INFO, FOCUS_RULES } from "@/lib/progression/config";
import { focusElapsedSeconds, formatClock } from "@/lib/progression/focus";
import { cn } from "@/lib/utils/cn";
import type { FocusSession } from "@/server/services/focus";

type Session = Pick<FocusSession, "id" | "status" | "startedAt" | "pausedAt" | "totalPausedSeconds" | "plannedSeconds"> & {
  questTitle: string | null;
};
type Break = { kind: "short" | "long"; endsAt: number };

// The suggested break lives in localStorage (it earns nothing, so it needn't touch the server)
// and is read through an external store so a refresh restores it without a hydration mismatch.
const BREAK_KEY = "awaken.focus.break";
const BREAK_EVENT = "awaken:break";
function readBreakRaw(): string | null {
  try {
    return window.localStorage.getItem(BREAK_KEY);
  } catch {
    return null;
  }
}
function subscribeBreak(cb: () => void) {
  window.addEventListener(BREAK_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(BREAK_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function saveBreak(b: Break | null) {
  try {
    if (b) window.localStorage.setItem(BREAK_KEY, JSON.stringify(b));
    else window.localStorage.removeItem(BREAK_KEY);
  } catch {
    // Storage unavailable (private mode): the break simply won't survive a refresh.
  }
  window.dispatchEvent(new Event(BREAK_EVENT));
}
function parseBreak(raw: string | null): Break | null {
  try {
    return raw ? (JSON.parse(raw) as Break) : null;
  } catch {
    return null;
  }
}

/**
 * The current server time in ms, advanced by an interval while `active`. Render stays pure:
 * time only moves inside the interval callback. `skew` is server minus device time.
 */
function useServerClock(serverNow: string, active: boolean) {
  const [nowMs, setNowMs] = useState(() => Date.parse(serverNow));
  const skew = useRef<number | null>(null);
  const sync = useCallback((serverIso: string) => {
    skew.current = Date.parse(serverIso) - Date.now();
    setNowMs(Date.parse(serverIso));
  }, []);
  useEffect(() => {
    if (skew.current === null) skew.current = Date.parse(serverNow) - Date.now();
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now() + (skew.current ?? 0)), 250);
    return () => clearInterval(id);
  }, [active, serverNow]);
  /** Server time for event handlers (reads the ref, so never call during render). */
  const serverNowMs = useCallback(() => Date.now() + (skew.current ?? 0), []);
  return { nowMs, sync, serverNowMs };
}

export function FocusTimer({
  initial,
  serverNow,
  hasDeepFocus,
  quests,
}: {
  initial: Session | null;
  serverNow: string;
  hasDeepFocus: boolean;
  quests: { id: string; title: string; estimatedMinutes: number | null }[];
}) {
  const router = useRouter();
  const showCompletion = useShowCompletion();
  const showLevelUp = useShowLevelUp();
  const [pending, startTransition] = useTransition();
  const [session, setSession] = useState<Session | null>(initial);
  const [minutes, setMinutes] = useState(25);
  const [questId, setQuestId] = useState<string>("");
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const completing = useRef(false);

  const storedBreak = parseBreak(useSyncExternalStore(subscribeBreak, readBreakRaw, () => null));
  const { nowMs, sync, serverNowMs } = useServerClock(serverNow, session?.status === "running" || !!storedBreak);
  // Breaks are stored in server time too; a finished break lingers a minute before clearing.
  const rest = storedBreak && storedBreak.endsAt > nowMs - 60_000 ? storedBreak : null;

  const elapsed = session ? focusElapsedSeconds(session, new Date(nowMs)) : 0;
  const remaining = session ? Math.max(0, session.plannedSeconds - elapsed) : minutes * 60;
  const ratio = session ? Math.min(1, elapsed / session.plannedSeconds) : 0;
  const restLeft = rest ? Math.max(0, Math.round((rest.endsAt - nowMs) / 1000)) : 0;

  const complete = useCallback(
    (id: string) => {
      if (completing.current) return;
      completing.current = true;
      startTransition(async () => {
        const r = await completeFocusAction(id);
        completing.current = false;
        if (!r.ok) return setMessage({ tone: "error", text: r.error });
        sync(r.serverNow);
        const d = r.data;
        setSession(null);
        if (d.status === "already_ended") return setMessage({ tone: "info", text: "That session was already recorded." });
        if (d.quest) showCompletion(d.quest);
        else if (d.levelChange) showLevelUp(d.levelChange);
        const gains = [
          d.xp.granted ? `+${d.xp.granted} XP` : null,
          ...d.attributes.filter((a) => a.granted > 0).map((a) => `+${a.granted} ${ATTRIBUTE_INFO[a.attribute].short}`),
        ].filter(Boolean);
        setMessage({
          tone: "success",
          text: [
            d.via === "quest" ? "Session complete — linked quest completed." : "Session complete.",
            gains.join(" · "),
            d.xp.note,
            d.linkedQuestNote,
            !d.quest && d.achievements.length ? `Achievement unlocked: ${d.achievements.map((a) => a.name).join(", ")}.` : null,
          ]
            .filter(Boolean)
            .join(" "),
        });
        saveBreak({ kind: d.suggestedBreak.kind, endsAt: serverNowMs() + d.suggestedBreak.minutes * 60_000 });
        router.refresh();
      });
    },
    [router, showCompletion, showLevelUp, sync, serverNowMs],
  );

  // Finish automatically when the countdown reaches zero (also after a refresh past the end).
  useEffect(() => {
    if (session && session.status === "running" && remaining <= 0) complete(session.id);
  }, [session, remaining, complete]);

  useEffect(() => {
    const base = "Focus · AWAKEN";
    document.title = session ? `${formatClock(remaining)} · ${session.status === "paused" ? "Paused" : "Focus"}` : rest ? `Break ${formatClock(restLeft)}` : base;
    return () => {
      document.title = base;
    };
  }, [session, remaining, rest, restLeft]);

  const act = (fn: () => Promise<{ ok: true; data: FocusSession; serverNow: string } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setMessage({ tone: "error", text: r.error });
      sync(r.serverNow);
      setSession((s) => (s ? { ...s, ...r.data } : s));
    });

  const presets = [...FOCUS_RULES.presets, ...(hasDeepFocus ? FOCUS_RULES.deepPresets : [])];
  const R = 88;
  const C = 2 * Math.PI * R;

  return (
    <div className="grid gap-6">
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <div className="flex flex-col items-center gap-6">
        <div className="relative grid size-64 place-items-center">
          <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-line)" strokeWidth="6" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={session?.status === "paused" ? "var(--color-warning)" : "url(#awaken-eye)"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - ratio)}
              className="transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <div className="text-center" role="timer" aria-live="off">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-glow">
              {session ? (session.status === "paused" ? "Paused" : "Focus") : rest ? "Break" : "Ready"}
            </p>
            <p className="font-mono text-5xl font-semibold tabular-nums">
              {rest && !session ? formatClock(restLeft) : formatClock(remaining)}
            </p>
            {session?.questTitle ? <p className="mt-1 max-w-48 truncate text-xs text-ink-muted">{session.questTitle}</p> : null}
          </div>
        </div>

        {session ? (
          <div className="flex flex-wrap justify-center gap-2">
            {session.status === "running" ? (
              <Button variant="outline" disabled={pending} onClick={() => act(() => pauseFocusAction(session.id))}>
                <Pause aria-hidden /> Pause
              </Button>
            ) : (
              <Button disabled={pending} onClick={() => act(() => resumeFocusAction(session.id))}>
                <Play aria-hidden /> Resume
              </Button>
            )}
            {confirmEnd ? (
              <>
                <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                  Keep going
                </Button>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await endFocusEarlyAction(session.id);
                      setConfirmEnd(false);
                      if (!r.ok) return setMessage({ tone: "error", text: r.error });
                      setSession(null);
                      setMessage({
                        tone: "info",
                        text: `Ended early — ${
                          r.data.creditedSeconds < 60 ? "under a minute" : `${Math.round(r.data.creditedSeconds / 60)} focused minutes`
                        } recorded. Only full sessions earn XP.`,
                      });
                      router.refresh();
                    })
                  }
                >
                  End session
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
                <Square aria-hidden /> End early
              </Button>
            )}
          </div>
        ) : rest ? (
          <div className="flex flex-col items-center gap-2">
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Coffee aria-hidden className="size-4" /> {rest.kind === "long" ? "Long break" : "Short break"} — step away.
            </p>
            <Button
              variant="outline"
              onClick={() => saveBreak(null)}
            >
              {restLeft > 0 ? "Skip break" : "Done"}
            </Button>
          </div>
        ) : (
          <div className="grid w-full max-w-md gap-4">
            <fieldset>
              <legend className="mb-2 text-center font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                Duration
              </legend>
              <div className="flex flex-wrap justify-center gap-2">
                {presets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={minutes === m}
                    onClick={() => setMinutes(m)}
                    className={cn(
                      "h-10 w-16 rounded-md border font-mono text-sm",
                      minutes === m ? "border-glow bg-glow-soft text-ink shadow-glow" : "border-line text-ink-muted hover:border-line-strong",
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              {!hasDeepFocus ? (
                <p className="mt-2 text-center text-xs text-ink-faint">Unlock Deep Focus in the skill tree for 50 and 90 minutes.</p>
              ) : null}
            </fieldset>
            <div className="grid gap-1.5">
              <label htmlFor="focus-quest" className="text-center font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                Working on (optional)
              </label>
              <Select id="focus-quest" value={questId} onChange={(e) => setQuestId(e.target.value)}>
                <option value="">Just focus</option>
                {quests.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                    {q.estimatedMinutes ? ` (~${q.estimatedMinutes} min)` : ""}
                  </option>
                ))}
              </Select>
              <p className="text-center text-xs text-ink-faint">
                If the session covers the quest&apos;s estimate, finishing it completes the quest — you get the quest&apos;s
                reward instead of the focus reward.
              </p>
            </div>
            <Button
              size="lg"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  const r = await startFocusAction({ minutes, questId: questId || null });
                  if (!r.ok) return setMessage({ tone: "error", text: r.error });
                  sync(r.serverNow);
                  setSession({ ...r.data.session, questTitle: quests.find((q) => q.id === r.data.session.playerQuestId)?.title ?? null });
                  if (r.data.resumedExisting) setMessage({ tone: "info", text: "You already had a session running — picked it back up." });
                })
              }
            >
              <Play aria-hidden /> Start {minutes}-minute session
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
