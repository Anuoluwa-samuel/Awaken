import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import type { weeklyChallenge } from "@/db/schema";
import { CATEGORY_INFO } from "@/lib/progression/config";

type Challenge = typeof weeklyChallenge.$inferSelect;

export function WeeklyChallengeRow({ challenge: c }: { challenge: Challenge }) {
  const tone = c.status === "completed" ? "success" : "glow";
  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{c.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {c.countsAnyCategory ? "Any quest counts" : `${CATEGORY_INFO[c.category].label} quests count`} · ends{" "}
            {c.deadlineAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-sm font-semibold text-glow">+{c.xpReward} XP</span>
          {c.status === "completed" ? (
            <Badge tone="success">{c.rewardClaimedAt ? "Reward granted" : "Complete"}</Badge>
          ) : c.status === "expired" ? (
            <Badge tone="muted">Expired</Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar value={c.progress / c.target} label={`${c.title} progress`} tone={tone} />
        <span className="shrink-0 font-mono text-xs text-ink-muted">
          {c.progress}/{c.target}
        </span>
      </div>
    </li>
  );
}
