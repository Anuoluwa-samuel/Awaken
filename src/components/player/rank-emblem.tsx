import { useId } from "react";
import { RANKS, type RankId } from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";

// Original rank insignia: a double hex plate with the rank letter. Each rank is more striking than
// the last, using only the brand's steel, electric blue and awakening lime (glows live in globals.css).
const BLUE = "#2583ff";
const LIME = "#b6ff4a";
export const RANK_COLORS: Record<RankId, { stroke: string; inner: string; fill: string; text: string }> = {
  E: { stroke: "#7684a0", inner: "#7684a0", fill: "#7684a014", text: "#c3cbd9" },
  D: { stroke: "#4a6ea8", inner: "#4a6ea8", fill: "#4a6ea81a", text: "#b5c8e6" },
  C: { stroke: BLUE, inner: BLUE, fill: "#2583ff1a", text: "#8cc2ff" },
  B: { stroke: "#4d9bff", inner: BLUE, fill: "#2583ff2e", text: "#c4deff" },
  A: { stroke: "#4d9bff", inner: LIME, fill: "#2583ff33", text: "#ffffff" },
  S: { stroke: LIME, inner: LIME, fill: "#b6ff4a1f", text: "#e4ffbf" },
  N: { stroke: "gradient", inner: LIME, fill: "#2583ff33", text: "#ffffff" },
};

export function RankEmblem({
  rank,
  className,
  title,
}: {
  rank: RankId;
  className?: string;
  /** Accessible name; omit when a visible label is next to it. */
  title?: string;
}) {
  const c = RANK_COLORS[rank];
  const gradientId = `rank-${useId().replace(/:/g, "")}`;
  const stroke = c.stroke === "gradient" ? `url(#${gradientId})` : c.stroke;
  return (
    <svg
      viewBox="0 0 64 72"
      data-rank={rank}
      className={cn("rank-emblem size-12 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {c.stroke === "gradient" ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={BLUE} />
            <stop offset="0.5" stopColor={LIME} />
            <stop offset="1" stopColor={BLUE} />
          </linearGradient>
        </defs>
      ) : null}
      <path d="M32 3 59 18.5v35L32 69 5 53.5v-35Z" fill={c.fill} stroke={stroke} strokeWidth={rank === "E" ? 2 : 2.5} />
      <path
        d="M32 11 52 22.5v27L32 61 12 49.5v-27Z"
        fill="none"
        stroke={c.inner}
        strokeOpacity={rank === "A" || rank === "S" || rank === "N" ? 0.8 : 0.45}
        strokeWidth="1.2"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.text}
        className="font-display"
        fontWeight="700"
        fontSize={rank === "N" ? 18 : 24}
      >
        {rank === "N" ? "NL" : rank}
      </text>
    </svg>
  );
}

/** The rank's name in its own treatment; see .rank-badge in globals.css. */
export function RankBadge({ rank, className }: { rank: RankId; className?: string }) {
  return (
    <span data-rank={rank} className={cn("rank-badge", className)}>
      {RANKS.find((r) => r.id === rank)!.label}
    </span>
  );
}
