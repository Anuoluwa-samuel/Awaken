import { Activity, Award, Flag, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AchievementIcon } from "@/components/achievements/achievement-icon";
import { AttributeChart, CategoryChart, QuestOutcomeChart, SeriesBarChart } from "@/components/analytics/charts";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { db } from "@/db";
import { parseRange, RANGES, rangeBounds, shortDate, type RangeKey } from "@/lib/analytics";
import { cn } from "@/lib/utils/cn";
import { getPlayerContext } from "@/server/player-context";
import { getAnalytics } from "@/server/services/analytics";

export const metadata: Metadata = { title: "Progress" };

const fmt = new Intl.NumberFormat();
const pct = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export default async function ProgressPage({ searchParams }: PageProps<"/system/progress">) {
  const range = parseRange((await searchParams).range);
  const { user, profile, today } = await getPlayerContext();
  const { from, to } = rangeBounds(today, range);
  const a = await getAnalytics(db, user.id, { from, to, today, timeZone: profile.timeZone, dayStartHour: profile.dayStartHour });
  const nothing = a.totals.xp === 0 && a.totals.questsCompleted === 0 && a.totals.habitCheckIns === 0 && a.totals.focusMinutes === 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Analytics</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Progress</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {shortDate(from)} – {shortDate(to)} · from your recorded activity only
          </p>
        </div>
        <nav aria-label="Date range" className="flex rounded-md border border-line bg-surface p-0.5">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link
              key={key}
              href={`/system/progress?range=${key}`}
              aria-current={key === range ? "page" : undefined}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium",
                key === range ? "bg-glow-soft text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {RANGES[key].label}
            </Link>
          ))}
        </nav>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="XP earned" value={fmt.format(a.totals.xp)} />
        <Tile label="Quests completed" value={fmt.format(a.totals.questsCompleted)} />
        <Tile label="Daily quest rate" value={pct(a.totals.scheduledRate)} hint="of finished days' scheduled quests" />
        <Tile label="Focus time" value={`${fmt.format(a.totals.focusMinutes)}m`} hint={`${a.totals.focusSessions} full sessions`} />
        <Tile label="Habit check-ins" value={fmt.format(a.totals.habitCheckIns)} />
        <Tile label="Day streak" value={String(a.totals.currentStreak)} hint={`best in range: ${a.totals.longestStreakInRange}`} />
        <Tile label="Goals completed" value={String(a.totals.goalsCompleted)} />
        <Tile label="Achievements" value={String(a.totals.achievements)} />
      </dl>

      {nothing ? (
        <Panel>
          <EmptyState icon={Activity} title="No data to analyse">No recorded activity in this range yet. Charts fill in as you complete quests, habits and focus sessions.</EmptyState>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          eyebrow={a.weekly ? "Per week" : "Per day"}
          title="Experience earned"
          table={<SimpleTable headers={[a.weekly ? "Week of" : "Day", "XP"]} rows={a.xp.map((d) => [shortDate(d.date), fmt.format(d.xp)])} />}
        >
          <SeriesBarChart data={a.xp} dataKey="xp" name="XP" unit="XP" weekly={a.weekly} />
        </ChartPanel>

        <ChartPanel
          eyebrow="Scheduled quests"
          title="Daily quest completion"
          table={
            <SimpleTable
              headers={[a.weekly ? "Week of" : "Day", "Completed", "Missed"]}
              rows={a.quests.map((d) => [shortDate(d.date), String(d.completed), String(d.missed)])}
            />
          }
          note="Missed = expired or skipped. Days you didn't open AWAKEN generate no quests, so they never count against you."
        >
          <QuestOutcomeChart data={a.quests} weekly={a.weekly} />
        </ChartPanel>

        <ChartPanel
          eyebrow="Cumulative points"
          title="Attribute progression"
          table={
            <SimpleTable
              headers={["Day", "STR", "INT", "DIS", "VIT", "CRE"]}
              rows={a.attributes
                .filter((_, i) => a.attributes.length <= 31 || i % 7 === 0 || i === a.attributes.length - 1)
                .map((d) => [shortDate(d.date), d.strength, d.intelligence, d.discipline, d.vitality, d.creativity].map(String))}
            />
          }
        >
          <AttributeChart data={a.attributes} />
        </ChartPanel>

        <ChartPanel
          eyebrow={a.weekly ? "Per week" : "Per day"}
          title="Focus time"
          table={
            <SimpleTable
              headers={[a.weekly ? "Week of" : "Day", "Minutes", "Full sessions"]}
              rows={a.focus.map((d) => [shortDate(d.date), String(d.minutes), String(d.sessions)])}
            />
          }
          note="Includes focused minutes from sessions ended early; only full sessions earn XP."
        >
          <SeriesBarChart data={a.focus} dataKey="minutes" name="Focus" unit="min" weekly={a.weekly} />
        </ChartPanel>

        <ChartPanel
          eyebrow="Completions"
          title="Activity by category"
          table={<SimpleTable headers={["Category", "Completed"]} rows={a.categories.map((c) => [c.label, String(c.completed)])} />}
        >
          {a.categories.length ? (
            <CategoryChart data={a.categories} />
          ) : (
            <EmptyState icon={Activity}>No quests completed in this range.</EmptyState>
          )}
        </ChartPanel>

        <Panel>
          <PanelHeader eyebrow="Consistency" title="Habits" />
          {a.habits.length === 0 ? (
            <EmptyState icon={Repeat}>No habits tracked in this range.</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Habit completion and streaks for the selected range</caption>
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Habit</th>
                  <th scope="col" className="px-2 py-2 font-medium">Rate</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">Streak</th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">Best</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.habits.map((h) => (
                  <tr key={h.id}>
                    <th scope="row" className="px-5 py-2.5 text-left font-normal">
                      {h.name}
                      {h.archived ? <span className="ml-1 text-xs text-ink-faint">(archived)</span> : null}
                    </th>
                    <td className="w-40 px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <ProgressBar className="h-1.5" value={h.rate ?? 0} label={`${h.name} completion rate`} />
                        <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-muted">{pct(h.rate)}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono">
                      {h.current} <span className="text-xs text-ink-faint">{h.unit === "days" ? "d" : "w"}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono">
                      {h.longest} <span className="text-xs text-ink-faint">{h.unit === "days" ? "d" : "w"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Milestones" title="Goals completed" />
          {a.goals.length === 0 ? (
            <EmptyState icon={Flag}>No goals completed in this range.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {a.goals.map((g) => (
                <li key={g.id} className="flex justify-between gap-3 px-5 py-3 text-sm">
                  <span>{g.title}</span>
                  <time className="text-xs text-ink-faint" dateTime={g.completedAt.toISOString()}>
                    {g.completedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Records" title="Achievements unlocked" />
          {a.achievements.length === 0 ? (
            <EmptyState icon={Award}>No achievements unlocked in this range.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {a.achievements.map((x) => (
                <li key={x.code} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <AchievementIcon name={x.icon} className="size-4 text-warning" />
                  <span className="flex-1">{x.name}</span>
                  <time className="text-xs text-ink-faint" dateTime={x.unlockedAt.toISOString()}>
                    {x.unlockedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel/80 px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold">{value}</dd>
      {hint ? <dd className="text-[11px] text-ink-faint">{hint}</dd> : null}
    </div>
  );
}

function ChartPanel({
  eyebrow,
  title,
  note,
  table,
  children,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  table: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader eyebrow={eyebrow} title={title} />
      <div className="px-3 pt-4 sm:px-5">{children}</div>
      <div className="grid gap-2 px-5 pb-4 pt-2">
        {note ? <p className="text-xs text-ink-faint">{note}</p> : null}
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">Show table</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-md border border-line">{table}</div>
        </details>
      </div>
    </Panel>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-panel-raised text-left text-ink-faint">
        <tr>
          {headers.map((h, i) => (
            <th key={h} scope="col" className={cn("px-3 py-1.5 font-medium", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={cn("px-3 py-1", j > 0 && "text-right font-mono")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
