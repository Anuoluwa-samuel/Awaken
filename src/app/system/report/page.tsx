import { ChevronLeft, ChevronRight, Compass, Skull, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StreakFlame } from "@/components/player/streak-flame";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { ATTRIBUTE_INFO, ATTRIBUTES } from "@/lib/progression/config";
import { addDays, questDay, weekStart as weekOf } from "@/lib/time";
import { cn } from "@/lib/utils/cn";
import { getPlayerContext } from "@/server/player-context";
import { getWeeklyReport } from "@/server/services/report";

export const metadata: Metadata = { title: "Weekly report" };

const fmt = new Intl.NumberFormat();
const dayName = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export default async function ReportPage({ searchParams }: PageProps<"/system/report">) {
  const { user, profile, today, week } = await getPlayerContext();
  const clock = { today, timeZone: profile.timeZone, dayStartHour: profile.dayStartHour };
  // Last full week by default; ?week=YYYY-MM-DD for any earlier one (snapped to its Monday).
  const requested = (await searchParams).week;
  const lastWeek = addDays(week, -7);
  const start =
    typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) && !Number.isNaN(Date.parse(requested))
      ? weekOf(requested) > lastWeek
        ? lastWeek
        : weekOf(requested)
      : lastWeek;
  // Nothing to report before the player joined: the week they started is the earliest one.
  const firstWeek = weekOf(questDay(profile.createdAt, profile.timeZone, profile.dayStartHour));
  const r = await getWeeklyReport(db, user.id, clock, start < firstWeek ? firstWeek : start);
  const change = r.previousXp > 0 ? Math.round(((r.totalXp - r.previousXp) / r.previousXp) * 100) : null;
  const maxDay = Math.max(1, ...r.days.map((d) => d.xp));
  const maxGain = Math.max(1, ...ATTRIBUTES.map((a) => r.gains[a]));

  return (
    <div className="grid gap-6">
      <Panel glow className="system-grid">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-glow">System report</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-wide">
              Week of {longDate(r.weekStart)} – {longDate(r.weekEnd)}
            </h1>
          </div>
          <nav aria-label="Weeks" className="flex gap-1.5">
            {r.weekStart > firstWeek ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/system/report?week=${addDays(r.weekStart, -7)}`}>
                  <ChevronLeft /> Earlier
                </Link>
              </Button>
            ) : null}
            {r.weekStart < lastWeek ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/system/report?week=${addDays(r.weekStart, 7)}`}>
                  Later <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </nav>
        </div>
        <dl className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4 sm:px-6 sm:pb-6">
          <Stat label="XP earned" value={fmt.format(r.totalXp)}>
            {change !== null ? (
              <span className={cn("text-xs", change >= 0 ? "text-success" : "text-ink-faint")}>
                {change >= 0 ? "+" : ""}
                {change}% vs week before
              </span>
            ) : null}
          </Stat>
          <Stat label="Quests completed" value={fmt.format(r.questsCompleted)} />
          <Stat label="Perfect days" value={`${r.perfectDays}/7`} />
          <Stat label="Day streak now" value="">
            <StreakFlame streak={r.streak} />
          </Stat>
        </dl>
      </Panel>

      {r.totalXp === 0 ? (
        <Panel>
          <EmptyState icon={Compass} title="No activity recorded">
            Nothing was earned this week. A single quest restarts the record.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Panel>
            <PanelHeader eyebrow="Daily XP" title={r.bestDay ? `Best day: ${dayName(r.bestDay.date)}` : "XP by day"} />
            <ol className="flex h-48 items-end gap-2 px-5 pb-4 pt-6" aria-label="XP earned each day">
              {r.days.map((d) => (
                <li key={d.date} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="pointer-events-none absolute -top-5 hidden rounded border border-line-strong bg-panel-raised px-1.5 py-0.5 font-mono text-xs group-hover:block">
                    {d.xp} XP
                  </span>
                  <span
                    className={cn("w-full max-w-10 rounded-t-[4px]", d.xp > 0 ? "bg-glow" : "bg-line")}
                    style={{ height: d.xp > 0 ? `${Math.max(4, (d.xp / maxDay) * 100)}%` : "2px" }}
                  />
                  <span className="text-[11px] text-ink-faint">
                    {dayName(d.date)}
                    <span className="sr-only">: {d.xp} XP</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Growth" title="Attributes gained" />
            <ul className="grid gap-2.5 px-5 py-4">
              {ATTRIBUTES.map((a) => (
                <li key={a} className="grid grid-cols-[2.75rem_1fr_2.5rem] items-center gap-3 text-sm">
                  <span className="font-display font-bold tracking-wider text-frost">{ATTRIBUTE_INFO[a].short}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface ring-1 ring-line" aria-hidden>
                    <span className="block h-full rounded-full bg-frost/80" style={{ width: `${(r.gains[a] / maxGain) * 100}%` }} />
                  </span>
                  <span className="text-right font-mono">+{r.gains[a]}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Weekly boss" title={r.boss ? r.boss.title : "No boss that week"} />
          <div className="flex items-center gap-3 px-5 py-4 text-sm">
            {r.boss ? (
              <>
                {r.boss.defeated ? <Trophy className="size-5 text-success" aria-hidden /> : <Skull className="size-5 text-ink-faint" aria-hidden />}
                <p>
                  {r.boss.defeated ? (
                    <span className="text-success">Defeated.</span>
                  ) : (
                    <span className="text-ink-muted">Escaped at {r.boss.progress}/{r.boss.target}.</span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-ink-muted">Bosses appear every Monday on the Quests page.</p>
            )}
          </div>
        </Panel>
        <Panel glow>
          <PanelHeader eyebrow="System recommendation" title={`Train ${r.suggestion.attributeLabel}`} />
          <p className="px-5 py-4 text-sm text-ink-muted">
            {r.strongest ? (
              <>
                Your strongest growth was <span className="text-ink">{r.strongest.label}</span> (+{r.strongest.points}).{" "}
              </>
            ) : null}
            Next week, pick a few <span className="text-ink">{r.suggestion.categoryLabel}</span> quests to bring up{" "}
            {r.suggestion.attributeLabel}. You can add it to your focus areas in{" "}
            <Link href="/system/settings" className="text-glow hover:underline">
              settings
            </Link>
            .
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface/70 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 flex flex-col">
        {value ? <span className="font-mono text-lg font-semibold">{value}</span> : null}
        {children}
      </dd>
    </div>
  );
}
