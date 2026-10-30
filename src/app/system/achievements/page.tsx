import { Lock, Tag } from "lucide-react";
import type { Metadata } from "next";
import { AchievementIcon } from "@/components/achievements/achievement-icon";
import { TitlePicker } from "@/components/achievements/title-picker";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { db } from "@/db";
import { cn } from "@/lib/utils/cn";
import { getPlayerContext } from "@/server/player-context";
import { listAchievements, listTitles } from "@/server/services/achievements";

export const metadata: Metadata = { title: "Achievements" };

export default async function AchievementsPage() {
  const { user, profile, today } = await getPlayerContext();
  const [achievements, titles] = await Promise.all([listAchievements(db, user.id, today), listTitles(db, user.id)]);
  const unlocked = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Records</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Achievements</h1>
        <p className="mt-2 text-sm text-ink-muted">
          <span className="font-mono text-ink">
            {unlocked}/{achievements.length}
          </span>{" "}
          unlocked. Every achievement is earned from your recorded activity.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <ul className="grid content-start gap-3 sm:grid-cols-2">
          {achievements.map((a) => {
            const done = !!a.unlockedAt;
            return (
              <li key={a.code}>
                <Panel className={cn("flex h-full gap-4 p-4", !done && "opacity-80")} glow={done}>
                  <div
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-lg border",
                      done ? "border-warning/50 bg-warning/10 text-warning" : "border-line bg-surface text-ink-faint",
                    )}
                  >
                    {done ? <AchievementIcon name={a.icon} className="size-6" /> : <Lock aria-hidden className="size-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-semibold tracking-wide">
                      {a.name}
                      <span className="sr-only">{done ? " — unlocked" : " — locked"}</span>
                    </h2>
                    <p className="text-sm text-ink-muted">{a.description}</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {[a.xpReward ? `+${a.xpReward} XP` : null, a.titleReward ? `Title: ${a.titleReward}` : null]
                        .filter(Boolean)
                        .join(" · ") || "Badge"}
                    </p>
                    {done ? (
                      <p className="mt-2 text-xs text-success">
                        Unlocked{" "}
                        <time dateTime={a.unlockedAt!.toISOString()}>
                          {a.unlockedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </time>
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar className="h-1.5" value={a.progress.ratio} label={`${a.name} progress`} />
                        <span className="shrink-0 font-mono text-xs text-ink-muted">
                          {a.progress.current}/{a.progress.target}
                        </span>
                      </div>
                    )}
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>

        <Panel className="h-fit">
          <PanelHeader eyebrow="Cosmetic" title="Titles" />
          {titles.length === 0 ? (
            <EmptyState icon={Tag}>Some achievements award a title you can show on your profile.</EmptyState>
          ) : (
            <TitlePicker titles={titles} equipped={profile.equippedTitle} />
          )}
        </Panel>
      </div>
    </div>
  );
}
