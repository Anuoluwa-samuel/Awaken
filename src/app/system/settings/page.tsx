import type { Metadata } from "next";
import { DeleteAccount } from "@/components/player/delete-account";
import { SettingsForm } from "@/components/player/settings-form";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { getPlayerContext } from "@/server/player-context";
import { getQuotaUsage } from "@/server/services/limits";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, user } = await getPlayerContext();
  const usage = await getQuotaUsage(db, user.id);
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
        <PanelHeader eyebrow="Fair use" title="Today's usage" />
        <div className="grid gap-3 p-5 sm:p-6">
          <p className="text-sm text-ink-muted">
            Limits on creating things, to keep AWAKEN fast for everyone. They reset at midnight UTC and never limit the XP
            you can earn.
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {usage.map((row) => (
              <div key={row.metric} className="flex justify-between gap-3">
                <dt className="text-ink-muted">{row.label}</dt>
                <dd className="font-mono">
                  {row.used}/{row.limit}
                </dd>
              </div>
            ))}
          </dl>
        </div>
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
