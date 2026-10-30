import { Check, GitBranch, Lock } from "lucide-react";
import type { Metadata } from "next";
import { SkillUnlock } from "@/components/skills/skill-unlock";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { db } from "@/db";
import { cn } from "@/lib/utils/cn";
import { getPlayerContext } from "@/server/player-context";
import { listSkillTree } from "@/server/services/skills";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  const { user } = await getPlayerContext();
  const tree = await listSkillTree(db, user.id);
  const tiers = [...new Set(tree.skills.map((s) => s.requiredLevel))].sort((a, b) => a - b);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Abilities</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Skill tree</h1>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            You earn one skill point per level. Skills add new quests, challenges and insights — they never change how
            much XP anything is worth.
          </p>
        </div>
        <Panel glow className="px-5 py-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-ink-faint">Skill points</p>
          <p className="font-mono text-3xl font-semibold text-glow">{tree.pointsAvailable}</p>
          <p className="text-[11px] text-ink-faint">{tree.pointsEarned} earned</p>
        </Panel>
      </div>

      <ol className="grid gap-6">
        {tiers.map((level) => (
          <li key={level}>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.25em] text-ink-muted">
              <GitBranch aria-hidden className="size-3.5" /> Level {level}
              {tree.level >= level ? <span className="text-success">· reached</span> : null}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tree.skills
                .filter((s) => s.requiredLevel === level)
                .map((s) => {
                  const unlocked = !!s.unlockedAt;
                  return (
                    <li key={s.code}>
                      <Panel
                        glow={unlocked}
                        className={cn("flex h-full flex-col gap-3 p-4", !unlocked && !s.canUnlock && "opacity-75")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-base font-semibold tracking-wide">{s.name}</h3>
                            <p className="mt-0.5 text-sm text-ink-muted">{s.description}</p>
                          </div>
                          {unlocked ? (
                            <Check aria-label="Unlocked" className="size-5 shrink-0 text-success" />
                          ) : !s.canUnlock ? (
                            <Lock aria-label="Locked" className="size-4 shrink-0 text-ink-faint" />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="glow">
                            {s.cost} point{s.cost === 1 ? "" : "s"}
                          </Badge>
                          {s.prerequisiteName ? <Badge tone="muted">Requires {s.prerequisiteName}</Badge> : null}
                          {!s.available ? <Badge tone="warning">Arrives with Focus</Badge> : null}
                        </div>
                        <div className="mt-auto flex items-end justify-between gap-3">
                          <p className="text-xs text-ink-faint">
                            {unlocked
                              ? `Unlocked ${s.unlockedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                              : (s.blockerMessage ?? "Ready to unlock.")}
                          </p>
                          <SkillUnlock code={s.code} name={s.name} cost={s.cost} canUnlock={s.canUnlock} />
                        </div>
                      </Panel>
                    </li>
                  );
                })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
