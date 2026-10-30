import { Award, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityFeed } from "@/components/player/activity-feed";
import { AttributeList } from "@/components/player/attribute-list";
import { StatusWindow } from "@/components/player/status-window";
import { QuestRow } from "@/components/quests/quest-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { getPlayerContext } from "@/server/player-context";
import { getRecentActivity, getShellSummary, getStatusWindow } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "Status" };

export default async function StatusPage({ searchParams }: PageProps<"/system">) {
  const { welcome } = await searchParams;
  const { user, profile, today } = await getPlayerContext();
  const [summary, status, activity] = await Promise.all([
    getShellSummary(db, user.id, today),
    getStatusWindow(db, user.id, { today, timeZone: profile.timeZone, dayStartHour: profile.dayStartHour }),
    getRecentActivity(db, user.id, 8),
  ]);
  const openQuests = status.todayQuests.filter((q) => q.status === "available" || q.status === "in_progress");

  return (
    <div className="grid gap-6">
      {welcome === "1" ? (
        <FormMessage tone="info">
          <span className="font-display font-semibold uppercase tracking-[0.2em] text-glow">Player registered.</span>{" "}
          Your first daily quests are ready.
        </FormMessage>
      ) : null}

      <StatusWindow
        name={profile.displayName}
        title={profile.equippedTitle}
        level={summary.level}
        rank={summary.rank}
        streak={status.streak}
        questsDone={summary.questsDone}
        questsTotal={summary.questsTotal}
        skillPoints={summary.skillPoints}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader
            eyebrow={openQuests.length > 0 ? "Daily quest available" : "Daily quests"}
            title="Today's quests"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/system/quests">View all</Link>
              </Button>
            }
          />
          {status.todayQuests.length === 0 ? (
            <EmptyState icon={ScrollText}>No quests scheduled today. Rest days count too.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {status.todayQuests.slice(0, 5).map((q) => (
                <QuestRow key={q.id} quest={q} compact />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Attributes" title="Player stats" />
          <AttributeList attributes={status.attributes} />
          <p className="border-t border-line px-5 py-3 text-xs text-ink-faint">
            Game mechanics for tracking your effort — not measurements of ability or health.
          </p>
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
          <PanelHeader
            eyebrow="Log"
            title="Recent activity"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/system/profile">History</Link>
              </Button>
            }
          />
          <ActivityFeed items={activity} />
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Records" title="Recent achievements" />
          {status.recentAchievements.length === 0 ? (
            <EmptyState icon={Award}>No achievements yet. Your first one is a single quest away.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {status.recentAchievements.map((a) => (
                <li key={a.code} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>{a.name}</span>
                  <time className="text-xs text-ink-faint" dateTime={a.unlockedAt.toISOString()}>
                    {a.unlockedAt.toLocaleDateString()}
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

