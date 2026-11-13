"use client";

/**
 * Small client-side game feedback: optional sounds (off until the player turns them on in
 * settings) and the floating "+N XP" that flies to the XP bar. Both are cosmetic and fail quietly.
 */

const SOUND_KEY = "awaken:sound";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(SOUND_KEY, "on");
    else localStorage.removeItem(SOUND_KEY);
  } catch {
    /* private mode: stays off */
  }
}

export type Cue = "complete" | "levelup" | "rankup" | "achievement";

// Short synthesised tones: no audio files to download, nothing loud.
const CUES: Record<Cue, { notes: number[]; step: number; type: OscillatorType }> = {
  complete: { notes: [660, 990], step: 0.07, type: "triangle" },
  achievement: { notes: [784, 988, 1319], step: 0.08, type: "triangle" },
  levelup: { notes: [523, 659, 784, 1047], step: 0.09, type: "sine" },
  rankup: { notes: [392, 523, 659, 784, 1047, 1319], step: 0.11, type: "sine" },
};

let ctx: AudioContext | null = null;

export function playCue(cue: Cue, force = false) {
  if (!force && !soundEnabled()) return;
  try {
    ctx ??= new AudioContext();
    const { notes, step, type } = CUES[cue];
    const t0 = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const start = t0 + i * step;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step * 2.4);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + step * 2.5);
    });
  } catch {
    /* no audio available */
  }
}

/** Where the player last pressed, so "+N XP" rises from the button they used. */
let lastPoint: { x: number; y: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => (lastPoint = { x: e.clientX, y: e.clientY }), { capture: true, passive: true });
}

export function floatXp(amount: number, tone: "glow" | "success" = "glow") {
  if (amount <= 0 || typeof document === "undefined" || typeof Element.prototype.animate !== "function") return;
  const from = lastPoint ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const el = document.createElement("div");
  el.className = "xp-float";
  el.dataset.tone = tone;
  el.textContent = `+${amount} XP`;
  el.setAttribute("aria-hidden", "true");
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  document.body.append(el);

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
  const target = [...document.querySelectorAll<HTMLElement>("[data-xp-target]")].find((t) => t.offsetParent !== null);
  const box = target?.getBoundingClientRect();
  const dx = box ? box.left + box.width / 2 - from.x : 0;
  const dy = box ? box.top + box.height / 2 - from.y : -80;
  const frames: Keyframe[] = reduced
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
    : [
        { transform: "translate(-50%, -50%) scale(0.6)", opacity: 0 },
        { transform: "translate(-50%, -150%) scale(1.15)", opacity: 1, offset: 0.25 },
        { transform: "translate(-50%, -150%) scale(1)", opacity: 1, offset: 0.45 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0.2 },
      ];
  const anim = el.animate(frames, { duration: reduced ? 1200 : 1100, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" });
  anim.onfinish = () => {
    el.remove();
    if (target && !reduced) target.animate([{ filter: "brightness(1.8)" }, { filter: "none" }], { duration: 500 });
  };
}
