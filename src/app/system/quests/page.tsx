import { Plus, ScrollText, Swords, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QuestActions } from "@/components/quests/quest-actions";
import { QuestRow } from "@/components/quests/quest-row";
import { WeeklyChallengeRow } from "@/components/quests/weekly-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { LIMITS } from "@/lib/progression/config";
import { getPlayerContext } from "@/server/player-context";
import { listOpenOneOffQuests, listQuestsForDay } from "@/server/services/quests";
import { listWeeklyChallenges } from "@/server/services/weekly";

export const metadata: Metadata = { title: "Quests" };

function actionsFor(q: { id: string; status: string; title: string }) {
  return q.status === "available" || q.status === "in_progress" ? (
    <QuestActions questId={q.id} status={q.status} title={q.title} />
  ) : null;
}

export default async function QuestsPage({ searchParams }: PageProps<"/system/quests">) {
  const { created } = await searchParams;
  const { user, today, week } = await getPlayerContext();
  const [todays, oneOff, weekly] = await Promise.all([
    listQuestsForDay(db, user.id, today),
    listOpenOneOffQuests(db, user.id),
    listWeeklyChallenges(db, user.id, week),
  ]);
  // One-off quests created today also match today's date; show them only in their own section.
  const scheduled = todays.filter((q) => q.templateId);
  const done = scheduled.filter((q) => q.status === "completed").length;
  const remaining = scheduled.reduce(
    (sum, q) => sum + (q.status === "available" || q.status === "in_progress" ? q.xpReward : 0),
    0,
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Quest log</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Quests</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {done}/{scheduled.length} daily complete · <span className="font-mono text-ink">{remaining} XP</span> still
            available today
          </p>
        </div>
        <Button asChild>
          <Link href="/system/quests/new">
            <Plus aria-hidden /> New quest
          </Link>
        </Button>
      </div>

      {created === "1" ? <FormMessage tone="success">Quest registered with the System.</FormMessage> : null}

      <Panel>
        <PanelHeader eyebrow={today} title="Daily quests" />
        {scheduled.length === 0 ? (
          <EmptyState icon={ScrollText}>No quests scheduled today. Rest days count too.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {scheduled.map((q) => (
              <QuestRow key={q.id} quest={q} actions={actionsFor(q)} />
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="Your quests" title="Custom quests" />
          {oneOff.length === 0 ? (
            <EmptyState icon={Swords}>
              No open custom quests. <Link href="/system/quests/new" className="text-glow hover:underline">Create one</Link>.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {oneOff.map((q) => (
                <QuestRow key={q.id} quest={q} compact actions={actionsFor(q)} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow={`Week of ${week}`} title="Weekly challenges" />
          {weekly.length === 0 ? (
            <EmptyState icon={Trophy}>No weekly challenges this week.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {weekly.map((c) => (
                <WeeklyChallengeRow key={c.id} challenge={c} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Completions are self-reported — the System trusts you. Quest XP is limited to {LIMITS.dailyQuestXpCap} per day,
        and custom quests give XP for up to {LIMITS.customCompletionsPerCategoryPerDay} completions per category per day.
        Unfinished daily quests expire at your day reset and never cost you XP.
      </p>
    </div>
  );
}
