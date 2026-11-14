import { ProgressBar } from "@/components/ui/progress";
import type { getShellSummary } from "@/server/services/dashboard";
import { RankBadge } from "@/components/player/rank-emblem";
import { StreakFlame } from "@/components/player/streak-flame";

type Summary = Awaited<ReturnType<typeof getShellSummary>>;

export function PlayerSummary({ name, summary, streak }: { name: string; summary: Summary; streak: number }) {
  const { level, rank } = summary;
  return (
    <div className="rounded-lg border border-line bg-surface/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-display text-sm font-semibold">{name}</p>
        <RankBadge rank={rank.rank.id} className="shrink-0" />
      </div>
      <div className="mt-2 flex items-baseline justify-between text-xs text-ink-muted">
        <span>
          LV <span className="font-mono text-base font-semibold text-ink">{level.level}</span>
        </span>
        <span className="font-mono">
          {level.xpIntoLevel}/{level.xpForNext} XP
        </span>
      </div>
      <div data-xp-target>
        <ProgressBar className="mt-1.5" value={level.ratio} label={`Experience toward level ${level.level + 1}`} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
      <p className="text-xs text-ink-muted">
        Daily quests{" "}
        <span className="font-mono text-ink">
          {summary.questsDone}/{summary.questsTotal}
        </span>
      </p>
      <StreakFlame streak={streak} size="sm" />
      </div>
    </div>
  );
}
