import { ProgressBar } from "@/components/ui/progress";
import type { getShellSummary } from "@/server/services/dashboard";

type Summary = Awaited<ReturnType<typeof getShellSummary>>;

export function PlayerSummary({ name, summary }: { name: string; summary: Summary }) {
  const { level, rank } = summary;
  return (
    <div className="rounded-lg border border-line bg-surface/70 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-display text-sm font-semibold">{name}</p>
        <p className="shrink-0 font-display text-xs font-semibold tracking-wider text-arcane">{rank.rank.label}</p>
      </div>
      <div className="mt-2 flex items-baseline justify-between text-xs text-ink-muted">
        <span>
          LV <span className="font-mono text-base font-semibold text-ink">{level.level}</span>
        </span>
        <span className="font-mono">
          {level.xpIntoLevel}/{level.xpForNext} XP
        </span>
      </div>
      <ProgressBar className="mt-1.5" value={level.ratio} label={`Experience toward level ${level.level + 1}`} />
      <p className="mt-2.5 text-xs text-ink-muted">
        Daily quests{" "}
        <span className="font-mono text-ink">
          {summary.questsDone}/{summary.questsTotal}
        </span>
      </p>
    </div>
  );
}
