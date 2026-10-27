import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { QuestRow } from "@/components/quests/quest-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { getPlayerContext } from "@/server/player-context";
import { listQuestsForDay } from "@/server/services/quests";

export const metadata: Metadata = { title: "Quests" };

export default async function QuestsPage() {
  const { user, today } = await getPlayerContext();
  const quests = await listQuestsForDay(db, user.id, today);
  const done = quests.filter((q) => q.status === "completed").length;
  const available = quests.reduce((sum, q) => sum + (q.status === "completed" ? 0 : q.xpReward), 0);

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Quest log</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Daily quests</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {done}/{quests.length} complete · <span className="font-mono text-ink">{available} XP</span> still available
          today
        </p>
      </div>

      <Panel>
        <PanelHeader eyebrow={today} title="Today" />
        {quests.length === 0 ? (
          <EmptyState icon={ScrollText}>No daily quests scheduled for today.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {quests.map((q) => (
              <QuestRow key={q.id} quest={q} />
            ))}
          </ul>
        )}
        <p className="border-t border-line px-5 py-3 text-xs text-ink-faint">
          Quest completion, custom quests and weekly challenges arrive with the quest engine (Phase 4). Unfinished
          daily quests expire at your day reset and never cost you XP.
        </p>
      </Panel>
    </div>
  );
}
