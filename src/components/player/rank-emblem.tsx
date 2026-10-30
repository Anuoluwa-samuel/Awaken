import type { RankId } from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";

// Original rank insignia: a double hex plate with the rank letter. Colours climb from
// muted steel (E) to the brand gradient (National-Level).
export const RANK_COLORS: Record<RankId, { stroke: string; fill: string; text: string }> = {
  E: { stroke: "#7d8aa3", fill: "#7d8aa31a", text: "#c3cbd9" },
  D: { stroke: "#3ddc97", fill: "#3ddc971a", text: "#8ff0c4" },
  C: { stroke: "#4f9dff", fill: "#4f9dff1f", text: "#9cc8ff" },
  B: { stroke: "#9b7bff", fill: "#9b7bff1f", text: "#c9b8ff" },
  A: { stroke: "#f5b544", fill: "#f5b5441f", text: "#ffd892" },
  S: { stroke: "#ff6b7a", fill: "#ff6b7a1f", text: "#ffb0b8" },
  N: { stroke: "url(#awaken-hex)", fill: "#4f9dff26", text: "#ffffff" },
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
  return (
    <svg
      viewBox="0 0 64 72"
      className={cn("size-12", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M32 3 59 18.5v35L32 69 5 53.5v-35Z" fill={c.fill} stroke={c.stroke} strokeWidth="2.5" />
      <path d="M32 11 52 22.5v27L32 61 12 49.5v-27Z" fill="none" stroke={c.stroke} strokeOpacity="0.45" strokeWidth="1.2" />
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
