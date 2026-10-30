import { Timer } from "lucide-react";
import type { Metadata } from "next";
import { FocusTimer } from "@/components/focus/focus-timer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { FOCUS_RULES } from "@/lib/progression/config";
import { getPlayerContext } from "@/server/player-context";
import { getActiveFocus, getFocusSummary, hasDeepFocus } from "@/server/services/focus";
import { listOpenOneOffQuests, listQuestsForDay } from "@/server/services/quests";

export const metadata: Metadata = { title: "Focus" };

const minutes = (s: number) => Math.round(s / 60);

export default async function FocusPage() {
  const { user, today } = await getPlayerContext();
  const [active, summary, deep, todays, oneOff] = await Promise.all([
    getActiveFocus(db, user.id),
    getFocusSummary(db, user.id, today),
    hasDeepFocus(db, user.id),
    listQuestsForDay(db, user.id, today),
    listOpenOneOffQuests(db, user.id),
  ]);
  const open = [...todays.filter((q) => q.templateId), ...oneOff].filter(
    (q) => q.status === "available" || q.status === "in_progress",
  );

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Deep work</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Focus</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Full sessions earn XP ({Math.round(25 * FOCUS_RULES.xpPerMinute)} XP per 25 minutes). Paused time doesn&apos;t count,
          and the timer keeps going if you refresh or close the tab.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel glow className="p-6">
          <FocusTimer
            initial={active ? { ...active.session, questTitle: active.quest?.title ?? null } : null}
            serverNow={new Date().toISOString()}
            hasDeepFocus={deep}
            quests={open.map((q) => ({ id: q.id, title: q.title, estimatedMinutes: q.estimatedMinutes }))}
          />
        </Panel>

        <div className="grid content-start gap-6">
          <Panel>
            <PanelHeader eyebrow="Totals" title="Focus time" />
            <dl className="grid grid-cols-3 gap-3 p-5">
              {[
                ["Today", `${minutes(summary.todaySeconds)}m`],
                ["Last 7 days", `${minutes(summary.weekSeconds)}m`],
                ["Sessions today", String(summary.completedToday)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-line bg-surface/70 px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
                  <dd className="mt-0.5 font-mono text-lg font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Log" title="Session history" />
            {summary.recent.length === 0 ? (
              <EmptyState icon={Timer}>No sessions yet. Your first one is a click away.</EmptyState>
            ) : (
              <ol className="divide-y divide-line">
                {summary.recent.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-mono">
                        {minutes(s.creditedSeconds)}
                        <span className="text-ink-faint">/{minutes(s.plannedSeconds)} min</span>
                      </p>
                      {s.questTitle ? <p className="truncate text-xs text-ink-muted">{s.questTitle}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={s.status === "completed" ? "success" : "muted"}>
                        {s.status === "completed" ? "Full" : "Ended early"}
                      </Badge>
                      <time className="text-xs text-ink-faint" dateTime={s.startedAt.toISOString()}>
                        {s.startedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
