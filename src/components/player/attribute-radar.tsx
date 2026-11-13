"use client";

import { useState } from "react";
import { ATTRIBUTE_INFO, type Attribute } from "@/lib/progression/config";

const SIZE = 240;
const C = SIZE / 2;
const R = 82;
const RINGS = [0.25, 0.5, 0.75, 1];

/**
 * The player's build at a glance: one blue shape over five attribute axes. A single series, so no
 * legend; the attribute list beside it carries the exact numbers (and is the accessible table view).
 */
export function AttributeRadar({ attributes }: { attributes: { attribute: Attribute; points: number }[] }) {
  const [active, setActive] = useState<Attribute | null>(null);
  const max = Math.max(20, ...attributes.map((a) => a.points));
  const n = attributes.length;
  const at = (i: number, r: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [C + Math.cos(angle) * r, C + Math.sin(angle) * r] as const;
  };
  const points = attributes.map((a, i) => at(i, (a.points / max) * R));
  const shape = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const hovered = attributes.findIndex((a) => a.attribute === active);

  return (
    <figure className="relative mx-auto w-full max-w-[260px] px-2 pt-4">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full overflow-visible" role="img" aria-label={`Attribute shape: ${attributes.map((a) => `${ATTRIBUTE_INFO[a.attribute].label} ${a.points}`).join(", ")}`}>
        {RINGS.map((f) => (
          <polygon
            key={f}
            points={attributes.map((_, i) => at(i, R * f).join(",")).join(" ")}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={1}
          />
        ))}
        {attributes.map((a, i) => {
          const [x, y] = at(i, R);
          const [lx, ly] = at(i, R + 20);
          return (
            <g key={a.attribute}>
              <line x1={C} y1={C} x2={x} y2={y} stroke="var(--color-line)" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-ink-muted font-display text-[11px] font-semibold tracking-wider"
              >
                {ATTRIBUTE_INFO[a.attribute].short}
              </text>
            </g>
          );
        })}
        <polygon points={shape} fill="#2583ff2e" stroke="#2583ff" strokeWidth={2} strokeLinejoin="round" className="radar-shape" />
        {points.map(([x, y], i) => {
          const a = attributes[i]!;
          return (
            <g key={a.attribute}>
              <circle cx={x} cy={y} r={hovered === i ? 6 : 4.5} fill="#2583ff" stroke="var(--color-panel)" strokeWidth={2} />
              {/* Bigger invisible hit target than the mark. */}
              <circle
                cx={x}
                cy={y}
                r={16}
                fill="transparent"
                onPointerEnter={() => setActive(a.attribute)}
                onPointerLeave={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {hovered >= 0 ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line-strong bg-panel-raised px-2.5 py-1.5 text-xs shadow-[var(--shadow-panel)]"
          style={{ left: `${(points[hovered]![0] / SIZE) * 100}%`, top: `calc(${(points[hovered]![1] / SIZE) * 100}% + 4px)` }}
        >
          <span className="text-ink-muted">{ATTRIBUTE_INFO[attributes[hovered]!.attribute].label}</span>{" "}
          <span className="font-mono font-semibold text-ink">{attributes[hovered]!.points}</span>
        </div>
      ) : null}
    </figure>
  );
}
