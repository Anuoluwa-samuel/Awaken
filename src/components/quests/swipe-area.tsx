"use client";

import { Check, X } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { cancelQuestAction, completeQuestAction } from "@/app/system/quests/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useShowCompletion } from "./completion-provider";

const THRESHOLD = 96;

/**
 * Touch only: swipe a quest right to complete it, left to skip it (skipping asks first, as the
 * button does). Mouse and keyboard users keep the buttons; vertical scrolling is untouched.
 */
export function SwipeArea({ questId, title, children }: { questId: string; title: string; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const showCompletion = useShowCompletion();

  const reset = () => {
    start.current = null;
    setDx(0);
  };

  const finish = () => {
    const distance = dx;
    reset();
    if (distance >= THRESHOLD) {
      startTransition(async () => {
        setError(null);
        const r = await completeQuestAction({ questId });
        if (r.ok) showCompletion(r.data);
        else setError(r.error);
      });
    } else if (distance <= -THRESHOLD) {
      setConfirmSkip(true);
    }
  };

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-between px-5 font-display text-xs font-semibold uppercase tracking-[0.15em] transition-opacity",
          dx === 0 ? "opacity-0" : "opacity-100",
          dx > 0 ? "bg-success/15 text-success" : "bg-danger/10 text-danger",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Check className="size-4" /> {dx >= THRESHOLD ? "Release to complete" : "Complete"}
        </span>
        <span className="flex items-center gap-1.5">
          {dx <= -THRESHOLD ? "Release to skip" : "Skip"} <X className="size-4" />
        </span>
      </div>
      <div
        className={cn("relative bg-panel", dx === 0 && "transition-transform duration-200", pending && "opacity-60")}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch" || pending) return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const x = e.clientX - s.x;
          const y = e.clientY - s.y;
          // Decide once whether this is a swipe or a scroll.
          if (s.horizontal === null && Math.hypot(x, y) > 10) s.horizontal = Math.abs(x) > Math.abs(y) * 1.5;
          if (s.horizontal) setDx(Math.max(-140, Math.min(140, x)));
        }}
        onPointerUp={finish}
        onPointerCancel={reset}
      >
        {children}
      </div>
      {confirmSkip ? (
        <div role="alertdialog" aria-label={`Skip ${title}?`} className="flex items-center justify-between gap-3 bg-danger/10 px-5 py-2.5">
          <p className="text-sm">Skip this quest? It won&apos;t cost XP, but it ends today&apos;s combo.</p>
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setConfirmSkip(false)}>
              Keep
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await cancelQuestAction(questId);
                  if (!r.ok) setError(r.error);
                  setConfirmSkip(false);
                })
              }
            >
              Skip
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="px-5 pb-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
