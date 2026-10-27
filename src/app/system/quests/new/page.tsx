import type { Metadata } from "next";
import { QuestBuilder } from "@/components/quests/quest-builder";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getPlayerContext } from "@/server/player-context";

export const metadata: Metadata = { title: "New quest" };

export default async function NewQuestPage() {
  const { profile, today } = await getPlayerContext();
  return (
    <div className="grid max-w-3xl gap-6">
      <Panel>
        <PanelHeader as="h1" eyebrow="Quest builder" title="Create a quest" />
        <div className="p-5 sm:p-6">
          <QuestBuilder defaultDifficulty={profile.preferredDifficulty} today={today} />
        </div>
      </Panel>
    </div>
  );
}
