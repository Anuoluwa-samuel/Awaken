"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export function ProgressBar({
  value,
  label,
  className,
  tone = "glow",
}: {
  /** 0–1 */
  value: number;
  label: string;
  className?: string;
  tone?: "glow" | "frost" | "success";
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);

  // When the value rises while on screen (XP earned), the bar eases forward and a light sweeps it.
  // Tracked during render, not in an effect; the sweep's key remounts it so its animation replays.
  const [shown, setShown] = useState(pct);
  const [gains, setGains] = useState(0);
  if (pct !== shown) {
    if (pct > shown) setGains((n) => n + 1);
    setShown(pct);
  }

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      // Alternates so the glow pulse restarts on every gain (same animation name wouldn't replay).
      data-gain={gains > 0 ? (gains % 2 ? "a" : "b") : undefined}
      className={cn("xp-track h-2 w-full overflow-hidden rounded-full bg-surface ring-1 ring-line", className)}
    >
      <div
        className={cn(
          "xp-fill relative h-full origin-left animate-fill overflow-hidden rounded-full",
          tone === "glow" && "bg-gradient-to-r from-[#1462e0] via-glow to-[#5aa8ff] shadow-[0_0_12px_#2583ffaa]",
          tone === "frost" && "bg-gradient-to-r from-[#2b5ea8] to-frost shadow-[0_0_8px_#8cc2ff66]",
          tone === "success" && "bg-success shadow-[0_0_10px_#b6ff4a88]",
        )}
        style={{ width: `${pct}%` }}
      >
        {gains > 0 ? <span key={gains} aria-hidden className="xp-gain" /> : null}
      </div>
    </div>
  );
}
