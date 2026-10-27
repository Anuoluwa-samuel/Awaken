"use client";

import { useEffect, useState } from "react";
import { MARK } from "./logo";

/** Minimum time on screen, measured from navigation start, so the sequence can finish. */
export const INTRO_MIN_MS = 2400;
const INTRO_MIN_MS_REDUCED = 500;
/** Never hold the page longer than this, even if `load` is slow. */
export const INTRO_MAX_MS = 6000;
const EXIT_MS = 650;

type Phase = "show" | "exit" | "done";

/**
 * Full-screen logo intro shown on every full page load. It is server-rendered, so the
 * CSS animation starts on first paint, before hydration. Once the window has loaded and
 * the minimum time has passed it fades out and unmounts. Client-side navigations keep it
 * unmounted because it lives in the root layout. Escape or a click skips it.
 * Without JavaScript, a CSS fallback hides it after INTRO_MAX_MS.
 */
export function IntroSplash() {
  const [phase, setPhase] = useState<Phase>("show");

  useEffect(() => {
    if (phase !== "show") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minMs = reduce ? INTRO_MIN_MS_REDUCED : INTRO_MIN_MS;
    let cancelled = false;
    const timers: number[] = [];
    const until = (ms: number) =>
      new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, Math.max(0, ms - performance.now()))));
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));

    const exit = () => !cancelled && setPhase("exit");
    Promise.race([Promise.all([loaded, until(minMs)]), until(INTRO_MAX_MS)]).then(exit);

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exit();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "exit") return;
    const t = window.setTimeout(() => setPhase("done"), EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className="intro"
      data-phase={phase}
      role="status"
      aria-live="polite"
      onClick={() => setPhase((p) => (p === "show" ? "exit" : p))}
    >
      <span className="sr-only">Loading AWAKEN</span>
      <div className="intro-stage" aria-hidden>
        <div className="intro-logo">
          <svg viewBox={MARK.viewBox} className="intro-mark" fill="none">
            <circle className="intro-flare" cx={MARK.pupil.cx} cy={MARK.pupil.cy} r="34" />
            <g
              className="intro-hex"
              stroke="url(#awaken-hex)"
              strokeWidth={MARK.stroke}
              strokeLinecap="square"
            >
              <path d={MARK.hexUpper} pathLength={1} />
              <path d={MARK.hexLower} pathLength={1} />
            </g>
            <g className="intro-eye" stroke="url(#awaken-eye)" strokeWidth={MARK.stroke} strokeLinecap="round">
              <path d={MARK.lidUpper} />
              <path d={MARK.lidLower} />
            </g>
            <circle className="intro-pupil" {...MARK.pupil} fill="url(#awaken-pupil)" />
          </svg>
          <p className="intro-word">
            {"AWAKEN".split("").map((ch, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </p>
        </div>
        <p className="intro-tagline">System initializing</p>
        <div className="intro-bar" />
      </div>
    </div>
  );
}
