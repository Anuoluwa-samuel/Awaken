import { ChevronsUp, Crown } from "lucide-react";
import type { Metadata } from "next";
import { RankEmblem } from "@/components/player/rank-emblem";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { db } from "@/db";
import { RANKS } from "@/lib/progression/config";
import { xpToReach } from "@/lib/progression/levels";
import { cn } from "@/lib/utils/cn";
import { getPlayerContext } from "@/server/player-context";
import { getProgressionHistory, getShellSummary } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "Profile" };

const fmt = new Intl.NumberFormat();
const rankLabel = (id: string) => RANKS.find((r) => r.id === id)?.label ?? id;

export default async function ProfilePage() {
  const { user, profile, today } = await getPlayerContext();
  const [summary, history] = await Promise.all([
    getShellSummary(db, user.id, today),
    getProgressionHistory(db, user.id),
  ]);
  const { level, rank } = summary;
  const current = RANKS.findIndex((r) => r.id === rank.rank.id);

  return (
    <div className="grid gap-6">
      <Panel glow className="system-grid">
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
          <RankEmblem rank={rank.rank.id} className="size-24 shrink-0" title={rank.rank.label} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-glow">Player profile</p>
            <h1 className="mt-1 truncate font-display text-3xl font-bold tracking-wide">{profile.displayName}</h1>
            <p className="text-sm text-ink-muted">
              {profile.equippedTitle ?? "No title equipped"} · Awakened{" "}
              {profile.createdAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Level" value={String(level.level)} />
              <Stat label="Lifetime XP" value={fmt.format(level.totalXp)} />
              <Stat label="Quests completed" value={fmt.format(history.questsCompleted)} />
              <Stat label="Skill points" value={String(summary.skillPoints)} />
            </dl>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Panel>
          <PanelHeader eyebrow="Progression" title="Rank ladder" />
          <ol className="divide-y divide-line">
            {RANKS.map((r, i) => {
              const reached = i <= current;
              const isCurrent = i === current;
              return (
                <li
                  key={r.id}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn("flex items-center gap-4 px-5 py-3", isCurrent && "bg-frost-soft/60")}
                >
                  <RankEmblem rank={r.id} className={cn("size-10 shrink-0", !reached && "opacity-35 grayscale")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-display font-semibold tracking-wide", !reached && "text-ink-muted")}>
                      {r.label}
                      {isCurrent ? (
                        <Badge tone="frost" className="ml-2 align-middle">
                          Current
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink-faint">
                      Level {r.minLevel}+ · {fmt.format(xpToReach(r.minLevel))} lifetime XP
                    </p>
                    {i === current + 1 ? (
                      <ProgressBar className="mt-2 h-1.5" tone="frost" value={rank.ratio} label={`Progress toward ${r.label}`} />
                    ) : null}
                  </div>
                  {i === current + 1 && rank.xpToNextRank != null ? (
                    <span className="shrink-0 font-mono text-xs text-ink-muted">{fmt.format(rank.xpToNextRank)} XP</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Panel>

        <div className="grid content-start gap-6">
          <Panel>
            <PanelHeader eyebrow="Records" title="Rank-up history" />
            {history.rankUps.length === 0 ? (
              <EmptyState icon={Crown}>No promotions yet. D-Rank begins at level 10.</EmptyState>
            ) : (
              <ol className="divide-y divide-line">
                {history.rankUps.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <RankEmblem rank={e.toRank} className="size-8 shrink-0" />
                    <span className="flex-1">
                      {rankLabel(e.fromRank)} → <span className="text-frost">{rankLabel(e.toRank)}</span> at level{" "}
                      {e.toLevel}
                    </span>
                    <DateCell at={e.createdAt} />
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Records" title="Level history" />
            {history.levels.length === 0 ? (
              <EmptyState icon={ChevronsUp}>Level 2 is {fmt.format(level.xpRemaining)} XP away.</EmptyState>
            ) : (
              <ol className="max-h-96 divide-y divide-line overflow-y-auto">
                {history.levels.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <ChevronsUp aria-hidden className="size-4 shrink-0 text-glow" />
                    <span className="flex-1 font-mono">
                      Lv {e.fromLevel} → {e.toLevel}
                    </span>
                    <DateCell at={e.createdAt} />
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
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

function DateCell({ at }: { at: Date }) {
  return (
    <time className="shrink-0 text-xs text-ink-faint" dateTime={at.toISOString()}>
      {at.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
    </time>
  );
}
