import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import type { LevelProgress, RankProgress } from "@/lib/progression/levels";
import { RankBadge, RankEmblem } from "./rank-emblem";
import { StreakFlame } from "./streak-flame";

export function StatusWindow({
  name,
  title,
  level,
  rank,
  streak,
  freezeAvailable,
  questsDone,
  questsTotal,
  skillPoints,
}: {
  name: string;
  title: string | null;
  level: LevelProgress;
  rank: RankProgress;
  streak: number;
  freezeAvailable: boolean;
  questsDone: number;
  questsTotal: number;
  /** Unspent skill points (spent in the skill tree, Phase 7). */
  skillPoints: number;
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
            {title ? <p className="text-sm text-frost">{title}</p> : <p className="text-sm text-ink-faint">No title equipped</p>}
            <div className="mt-2 flex items-center gap-2">
              <RankEmblem rank={rank.rank.id} className="size-8" />
              <RankBadge rank={rank.rank.id} />
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
            <div data-xp-target>
              <ProgressBar className="mt-2 h-2.5" value={level.ratio} label={`Experience toward level ${level.level + 1}`} />
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">
              {fmt.format(level.xpRemaining)} XP to level {level.level + 1}
            </p>
          </div>

          <div>
            <div className="flex items-end justify-between gap-4 text-xs">
              <p className="uppercase tracking-[0.18em] text-ink-muted">
                {rank.next ? (
                  <>
                    Next rank · <span className="text-frost">{rank.next.label}</span> at level {rank.next.minLevel}
                  </>
                ) : (
                  "Highest rank reached"
                )}
              </p>
              {rank.xpToNextRank != null ? (
                <p className="font-mono text-ink-muted">{fmt.format(rank.xpToNextRank)} XP to go</p>
              ) : null}
            </div>
            <ProgressBar
              className="mt-1.5 h-1.5"
              tone="frost"
              value={rank.ratio}
              label={rank.next ? `Progress toward ${rank.next.label}` : "Rank progress"}
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Lifetime XP" value={fmt.format(level.totalXp)} />
            <Stat label="Today" value={`${questsDone}/${questsTotal}`} />
            <div className="rounded-md border border-line bg-surface/70 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wider text-ink-faint">Day streak</dt>
              <dd className="mt-0.5 text-lg">
                <StreakFlame streak={streak} freezeAvailable={freezeAvailable} />
              </dd>
            </div>
            <Stat label="Skill points" value={String(skillPoints)} />
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
