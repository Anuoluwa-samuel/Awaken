import { cn } from "@/lib/utils/cn";

// The AWAKEN mark: a hex gate split into two interlocking strokes that flow into an
// opening eye. Geometry is shared by the static logo and the intro animation.
export const MARK = {
  viewBox: "0 0 120 136",
  hexUpper: "M108 57 H114 V40 L60 7 L6 40 V77 L15 72",
  hexLower: "M16 85 H6 V96 L60 129 L114 96 V71 L109 66",
  lidUpper: "M15 72 C35 39 84 28 109 66",
  lidLower: "M15 72 C38 105 84 105 109 66",
  pupil: { cx: 61, cy: 69, r: 14 },
  stroke: 6.5,
} as const;

/**
 * Gradients for every logo on the page. Rendered once in the root layout in a
 * zero-size (not display:none) SVG, so marks inside hidden containers still resolve them.
 */
export function LogoDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <defs>
        <linearGradient id="awaken-hex" x1="6" y1="7" x2="114" y2="129" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2f9bff" />
          <stop offset="0.55" stopColor="#3a7dff" />
          <stop offset="1" stopColor="#5a5cf5" />
        </linearGradient>
        <linearGradient id="awaken-eye" x1="60" y1="38" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b5cf0" />
          <stop offset="0.5" stopColor="#3b82ff" />
          <stop offset="1" stopColor="#0bc8ff" />
        </linearGradient>
        <linearGradient id="awaken-pupil" x1="61" y1="55" x2="61" y2="83" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f7dff" />
          <stop offset="1" stopColor="#10c6ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK.viewBox} aria-hidden className={cn("h-7 w-auto", className)} fill="none">
      <g stroke="url(#awaken-hex)" strokeWidth={MARK.stroke} strokeLinejoin="miter" strokeLinecap="square">
        <path d={MARK.hexUpper} />
        <path d={MARK.hexLower} />
      </g>
      <g stroke="url(#awaken-eye)" strokeWidth={MARK.stroke} strokeLinecap="round">
        <path d={MARK.lidUpper} />
        <path d={MARK.lidLower} />
      </g>
      <circle {...MARK.pupil} fill="url(#awaken-pupil)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-brand text-lg font-extrabold tracking-[0.24em] text-[#f1f4fb] print:text-ink">AWAKEN</span>
    </span>
  );
}
