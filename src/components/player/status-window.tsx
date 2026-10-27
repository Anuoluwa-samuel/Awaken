import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import type { LevelProgress, RankProgress } from "@/lib/progression/levels";

export function StatusWindow({
  name,
  title,
  level,
  rank,
  streak,
  questsDone,
  questsTotal,
}: {
  name: string;
  title: string | null;
  level: LevelProgress;
  rank: RankProgress;
  streak: number;
  questsDone: number;
  questsTotal: number;
}) {
  const fmt = new Intl.NumberFormat();
  return (
    <Panel glow className="system-grid overflow-hidden">
      <div className="border-b border-line px-5 py-3">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-glow">Status</p>
      </div>
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-5">
          <div
            aria-hidden
            className="grid size-20 place-items-center rounded-xl border border-line-strong bg-gradient-to-br from-panel-raised to-surface font-display text-3xl font-bold text-glow shadow-glow"
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-wide">{name}</h1>
            {title ? <p className="text-sm text-arcane">{title}</p> : <p className="text-sm text-ink-faint">No title equipped</p>}
            <div className="mt-2 flex gap-1.5">
              <Badge tone="arcane">{rank.rank.label}</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-5">
          <div>
            <div className="flex items-end justify-between gap-4">
              <p className="font-display text-sm uppercase tracking-[0.2em] text-ink-muted">
                Level <span className="ml-1 font-mono text-4xl font-semibold tracking-normal text-ink">{level.level}</span>
              </p>
              <p className="text-right font-mono text-sm text-ink-muted">
                <span className="text-ink">{fmt.format(level.xpIntoLevel)}</span> / {fmt.format(level.xpForNext)} XP
              </p>
            </div>
            <ProgressBar className="mt-2 h-2.5" value={level.ratio} label={`Experience toward level ${level.level + 1}`} />
            <p className="mt-1.5 text-xs text-ink-faint">
              {fmt.format(level.xpRemaining)} XP to level {level.level + 1}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Lifetime XP" value={fmt.format(level.totalXp)} />
            <Stat label="Today" value={`${questsDone}/${questsTotal}`} />
            <Stat label="Day streak" value={String(streak)} />
            <Stat
              label={rank.next ? `To ${rank.next.label}` : "Rank"}
              value={rank.xpToNextRank != null ? `${fmt.format(rank.xpToNextRank)} XP` : "Max"}
            />
          </dl>
        </div>
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-surface/70 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg font-semibold">{value}</dd>
    </div>
  );
}
