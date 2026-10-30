import type { Metadata } from "next";
import { HabitForm } from "@/components/habits/habit-form";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { getPlayerContext } from "@/server/player-context";
import { listLinkableTemplates } from "@/server/services/habits";

export const metadata: Metadata = { title: "New habit" };

export default async function NewHabitPage() {
  const { user } = await getPlayerContext();
  const linkable = await listLinkableTemplates(db, user.id);
  return (
    <div className="grid max-w-3xl gap-6">
      <Panel>
        <PanelHeader as="h1" eyebrow="Habit builder" title="Track a habit" />
        <div className="p-5 sm:p-6">
          <HabitForm linkable={linkable} />
        </div>
      </Panel>
    </div>
  );
}
