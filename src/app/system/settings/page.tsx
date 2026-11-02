import type { Metadata } from "next";
import { DeleteAccount } from "@/components/player/delete-account";
import { SettingsForm } from "@/components/player/settings-form";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getPlayerContext } from "@/server/player-context";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, user } = await getPlayerContext();
  return (
    <div className="grid max-w-2xl gap-6">
      <Panel>
        <PanelHeader as="h1" eyebrow="Configuration" title="Player settings" />
        <div className="p-5 sm:p-6">
          <SettingsForm
            defaults={{
              displayName: profile.displayName,
              timeZone: profile.timeZone,
              dayStartHour: profile.dayStartHour,
              focusAreas: profile.focusAreas,
              preferredDifficulty: profile.preferredDifficulty,
              dailyTarget: profile.dailyTarget,
              showOnLeaderboard: profile.showOnLeaderboard,
            }}
          />
        </div>
      </Panel>
      <Panel>
        <PanelHeader eyebrow="Account" title="Sign-in" />
        <dl className="grid gap-1 p-5 text-sm sm:p-6">
          <dt className="text-ink-faint">Email</dt>
          <dd>{user.email}</dd>
        </dl>
      </Panel>
      <Panel>
        <PanelHeader eyebrow="Danger zone" title="Delete account" />
        <div className="grid gap-4 p-5 sm:p-6">
          <p className="text-sm text-ink-muted">
            Permanently remove your account and everything in it. You&apos;ll be signed out on every device.
          </p>
          <DeleteAccount />
        </div>
      </Panel>
    </div>
  );
}
