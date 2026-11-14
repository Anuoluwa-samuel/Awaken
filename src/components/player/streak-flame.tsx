import { Flame, Snowflake } from "lucide-react";
import { flameTier } from "@/lib/progression/bonuses";
import { cn } from "@/lib/utils/cn";

/**
 * The day streak as a flame that grows with it: a spark from day 1, steadier at 7, blazing at 30,
 * legendary at 100. `freezeAvailable` says whether this week's one free missed day is still unused.
 */
export function StreakFlame({
  streak,
  freezeAvailable,
  size = "md",
  className,
}: {
  streak: number;
  freezeAvailable?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const tier = flameTier(streak);
  const label = `${streak}-day streak · ${tier.label}${
    freezeAvailable === undefined ? "" : freezeAvailable ? " · streak freeze ready" : " · streak freeze used this week"
  }`;
  return (
    <span className={cn("streak-flame", size === "sm" && "streak-flame-sm", className)} data-tier={tier.tier} title={label}>
      <Flame aria-hidden className="streak-flame-icon" />
      <span className="font-mono font-semibold">{streak}</span>
      <span className="sr-only">{label}</span>
      {freezeAvailable !== undefined ? (
        <Snowflake aria-hidden className={cn("size-3", freezeAvailable ? "text-frost" : "text-ink-faint opacity-50")} />
      ) : null}
    </span>
  );
}
