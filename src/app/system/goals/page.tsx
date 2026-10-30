import { CalendarClock, Flag, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AddMilestone, ArchiveGoal } from "@/components/goals/goal-controls";
import { MilestoneRow } from "@/components/goals/milestone-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { db } from "@/db";
import { CATEGORY_INFO, GOAL_RULES } from "@/lib/progression/config";
import { goalRewardXp } from "@/lib/progression/goals";
import { getPlayerContext } from "@/server/player-context";
import { listGoals } from "@/server/services/goals";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage({ searchParams }: PageProps<"/system/goals">) {
  const { created } = await searchParams;
  const { user, today } = await getPlayerContext();
  const goals = await listGoals(db, user.id, today);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Long game</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Goals</h1>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            Break big objectives into milestones. Progress moves only when a milestone is done.
          </p>
        </div>
        <Button asChild>
          <Link href="/system/goals/new">
            <Plus aria-hidden /> New goal
          </Link>
        </Button>
      </div>

      {created === "1" ? <FormMessage tone="success">Goal registered. One milestone at a time.</FormMessage> : null}

      {goals.length === 0 ? (
        <Panel>
          <EmptyState icon={Flag}>
            No goals yet. <Link href="/system/goals/new" className="text-glow hover:underline">Set your first one</Link>.
          </EmptyState>
        </Panel>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {goals.map(({ goal: g, milestones, progress, overdue, rewardPreview }) => {
            const active = g.status === "active";
            return (
              <li key={g.id}>
                <Panel glow={g.status === "completed"} className="flex h-full flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold tracking-wide">{g.title}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="muted">{CATEGORY_INFO[g.category].label}</Badge>
                        {g.status === "completed" ? <Badge tone="success">Completed</Badge> : null}
                        {g.deadline ? (
                          <Badge tone={overdue ? "warning" : "muted"}>
                            <CalendarClock aria-hidden className="size-3" /> {overdue ? "Past" : "By"} {g.deadline}
                          </Badge>
                        ) : null}
                      </div>
                      {g.description ? <p className="mt-2 text-sm text-ink-muted">{g.description}</p> : null}
                    </div>
                    <span className="font-mono text-sm text-ink-muted">
                      {progress.done}/{progress.total}
                    </span>
                  </div>

                  <ProgressBar value={progress.ratio} tone={g.status === "completed" ? "success" : "glow"} label={`${g.title} progress`} />

                  <ol className="divide-y divide-line">
                    {milestones.map((m) => (
                      <MilestoneRow key={m.id} milestone={m} active={active} />
                    ))}
                  </ol>

                  {active && milestones.length < GOAL_RULES.maxMilestones ? <AddMilestone goalId={g.id} /> : null}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-xs text-ink-faint">
                      {g.status === "completed"
                        ? `Completed ${g.completedAt?.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                        : rewardPreview.eligible
                          ? `Completing it is worth ${rewardPreview.xp} XP.`
                          : milestones.length >= GOAL_RULES.minMilestones && g.startDate >= today
                            ? `Worth ${goalRewardXp(milestones.length)} XP if completed from tomorrow.`
                            : rewardPreview.reason}
                    </p>
                    <ArchiveGoal goalId={g.id} title={g.title} />
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-ink-faint">
        Completing a goal earns {GOAL_RULES.xpPerMilestone} XP per milestone (up to {GOAL_RULES.maxXp}) when it has at least{" "}
        {GOAL_RULES.minMilestones} milestones and was set on an earlier day; up to {GOAL_RULES.maxRewardedPerDay} goals per day
        are rewarded. Milestones linked to quests are rewarded through the quest only.
      </p>
    </div>
  );
}
