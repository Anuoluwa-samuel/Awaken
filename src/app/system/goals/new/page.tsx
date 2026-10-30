import type { Metadata } from "next";
import { GoalForm } from "@/components/goals/goal-form";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getPlayerContext } from "@/server/player-context";

export const metadata: Metadata = { title: "New goal" };

export default async function NewGoalPage() {
  const { today } = await getPlayerContext();
  return (
    <div className="grid max-w-3xl gap-6">
      <Panel>
        <PanelHeader as="h1" eyebrow="Goal builder" title="Set a goal" />
        <div className="p-5 sm:p-6">
          <GoalForm today={today} />
        </div>
      </Panel>
    </div>
  );
}
