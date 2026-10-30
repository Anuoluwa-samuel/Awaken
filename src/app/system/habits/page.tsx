import { Flame, Link2, Plus, Repeat, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArchiveHabit } from "@/components/habits/archive-habit";
import { HabitCheckIn } from "@/components/habits/habit-check-in";
import { HabitHeatmap, HeatmapLegend } from "@/components/habits/habit-heatmap";
import { HabitInsights } from "@/components/habits/habit-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { db } from "@/db";
import { ATTRIBUTE_INFO, CATEGORY_INFO, HABIT_RULES } from "@/lib/progression/config";
import { describeSchedule, weekdayInsights } from "@/lib/progression/habits";
import { getPlayerContext } from "@/server/player-context";
import { listHabits } from "@/server/services/habits";
import { hasSkill } from "@/server/services/skills";

export const metadata: Metadata = { title: "Habits" };

type Item = Awaited<ReturnType<typeof listHabits>>[number];

function encouragement({ stats, schedule }: Item): string {
  if (stats.doneToday) return stats.current > 1 ? `${stats.current} ${stats.unit} running. Nice.` : "Logged for today.";
  if (schedule.kind === "weekly" && stats.thisWeek >= schedule.timesPerWeek) return "Weekly target met — anything more is a bonus.";
  if (!stats.scheduledToday) return "Rest day. Recovery is part of the plan.";
  if (stats.current === 0 && stats.longest > 0) return `Fresh start today — your best is ${stats.longest} ${stats.unit}.`;
  return stats.current > 0 ? "Keep it going today." : "Today is a good day to start.";
}

export default async function HabitsPage({ searchParams }: PageProps<"/system/habits">) {
  const { created } = await searchParams;
  const { user, today } = await getPlayerContext();
  const [habits, insights] = await Promise.all([listHabits(db, user.id, today), hasSkill(db, user.id, "consistency")]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Routines</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Habits</h1>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            Small things, done often. Rest days never break a streak, and a missed day never costs XP.
          </p>
        </div>
        <Button asChild>
          <Link href="/system/habits/new">
            <Plus aria-hidden /> New habit
          </Link>
        </Button>
      </div>

      {created === "1" ? <FormMessage tone="success">Habit registered. Your streak starts today.</FormMessage> : null}

      {habits.length === 0 ? (
        <Panel>
          <EmptyState icon={Repeat}>
            No habits yet. <Link href="/system/habits/new" className="text-glow hover:underline">Track your first one</Link>.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <ul className="grid gap-4 xl:grid-cols-2">
            {habits.map((item) => {
              const { habit: h, stats, schedule } = item;
              const restDay =
                !stats.scheduledToday || (schedule.kind === "weekly" && stats.thisWeek >= schedule.timesPerWeek);
              return (
                <li key={h.id}>
                  <Panel className="flex h-full flex-col gap-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-semibold tracking-wide">{h.name}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone="muted">{describeSchedule(schedule)}</Badge>
                          <Badge tone="muted">{CATEGORY_INFO[h.category].label}</Badge>
                          <Badge tone="arcane">+{ATTRIBUTE_INFO[h.attribute].short}</Badge>
                          {item.linkedQuestTitle ? (
                            <Badge tone="glow" title="Checking in completes this quest; only the quest's rewards apply.">
                              <Link2 aria-hidden className="size-3" /> {item.linkedQuestTitle}
                            </Badge>
                          ) : null}
                        </div>
                        {h.description ? <p className="mt-2 text-sm text-ink-muted">{h.description}</p> : null}
                      </div>
                      <HabitCheckIn habitId={h.id} name={h.name} doneToday={stats.doneToday} restDay={restDay} />
                    </div>

                    <dl className="grid grid-cols-3 gap-3">
                      <div className="rounded-md border border-line bg-surface/70 px-3 py-2">
                        <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-faint">
                          <Flame aria-hidden className="size-3 text-warning" /> Streak
                        </dt>
                        <dd className="mt-0.5 font-mono text-lg font-semibold">
                          {stats.current} <span className="text-xs font-normal text-ink-muted">{stats.unit}</span>
                        </dd>
                      </div>
                      <div className="rounded-md border border-line bg-surface/70 px-3 py-2">
                        <dt className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-faint">
                          <Trophy aria-hidden className="size-3" /> Best
                        </dt>
                        <dd className="mt-0.5 font-mono text-lg font-semibold">
                          {stats.longest} <span className="text-xs font-normal text-ink-muted">{stats.unit}</span>
                        </dd>
                      </div>
                      <div className="rounded-md border border-line bg-surface/70 px-3 py-2">
                        <dt className="text-[11px] uppercase tracking-wider text-ink-faint">
                          {schedule.kind === "weekly" ? "Last 4 wks" : "30-day rate"}
                        </dt>
                        <dd className="mt-0.5 font-mono text-lg font-semibold">
                          {stats.rate == null ? "—" : `${Math.round(stats.rate * 100)}%`}
                        </dd>
                      </div>
                    </dl>

                    {schedule.kind === "weekly" ? (
                      <div>
                        <div className="flex justify-between text-xs text-ink-muted">
                          <span>This week</span>
                          <span className="font-mono">
                            {stats.thisWeek}/{schedule.timesPerWeek}
                          </span>
                        </div>
                        <ProgressBar
                          className="mt-1 h-1.5"
                          tone={stats.thisWeek >= schedule.timesPerWeek ? "success" : "glow"}
                          value={stats.thisWeek / schedule.timesPerWeek}
                          label={`${h.name} this week`}
                        />
                      </div>
                    ) : null}

                    <div className="overflow-x-auto">
                      <HabitHeatmap weeks={item.calendar} label={h.name} />
                    </div>

                    {insights ? <HabitInsights {...weekdayInsights(schedule, item.calendar)} /> : null}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <p className="text-xs text-ink-muted">{encouragement(item)}</p>
                      <ArchiveHabit habitId={h.id} name={h.name} />
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
          <HeatmapLegend />
        </>
      )}

      <p className="text-xs leading-relaxed text-ink-faint">
        A check-in that counts toward the schedule earns {HABIT_RULES.xp} XP and {HABIT_RULES.attributePoints} attribute
        point (within the daily limits). Rest-day and extra check-ins are recorded without a reward. Habits linked to a
        quest complete that quest instead, so you&apos;re rewarded once. Check-ins are self-reported.
      </p>
    </div>
  );
}
