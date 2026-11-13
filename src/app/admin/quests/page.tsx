import type { Metadata } from "next";
import Link from "next/link";
import { PoolQuestForm, PoolRowActions } from "@/components/admin/pool-editor";
import { Wordmark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { CATEGORY_INFO } from "@/lib/progression/config";
import { PRIVATE_PAGE } from "@/lib/site";
import { cn } from "@/lib/utils/cn";
import { listQuestPool, MIN_ACTIVE_POOL, POOL_STATS_DAYS } from "@/server/services/quest-pool";

export const metadata: Metadata = { title: "Quest pool", ...PRIVATE_PAGE };

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function QuestPoolPage() {
  await requireAdmin();
  const pool = await listQuestPool(db);
  const active = pool.filter((q) => q.isActive).length;

  return (
    <div className="system-grid min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin" className="text-glow hover:underline">
            Analytics
          </Link>
          <Link href="/system" className="text-glow hover:underline">
            Back to the app
          </Link>
        </nav>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 pt-2 sm:px-6">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Admin</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Daily quest pool</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            {active} active quests (at least {MIN_ACTIVE_POOL} stay active). Skip rate counts skipped and expired quests over
            the last {POOL_STATS_DAYS} days; high ones are candidates to rewrite or retire. Built-in quests can be retired,
            not edited, so the seed stays the source for them.
          </p>
        </div>

        <Panel>
          <PanelHeader eyebrow="New" title="Add a quest to the pool" />
          <div className="p-5">
            <PoolQuestForm />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow={`Last ${POOL_STATS_DAYS} days`} title="All pool quests" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-5 py-2 font-medium">Quest</th>
                  <th className="px-3 py-2 text-right font-medium">Offered</th>
                  <th className="px-3 py-2 text-right font-medium">Done</th>
                  <th className="px-3 py-2 text-right font-medium">Skip rate</th>
                  <th className="px-5 py-2 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pool.map((q) => (
                  <tr key={q.id} className={cn("align-top", !q.isActive && "opacity-60")}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{q.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge tone="muted">{CATEGORY_INFO[q.category].label}</Badge>
                        <span data-difficulty={q.difficulty} className="difficulty-tag">
                          {q.difficulty}
                        </span>
                        {q.editable ? <Badge tone="frost">Custom</Badge> : null}
                        {!q.isActive ? <Badge tone="muted">Retired</Badge> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{q.offered}</td>
                    <td className="px-3 py-3 text-right font-mono">{q.completed}</td>
                    <td className={cn("px-3 py-3 text-right font-mono", q.offered >= 10 && q.skipRate >= 0.5 && "text-warning")}>
                      {q.offered ? pct(q.skipRate) : "–"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <PoolRowActions
                        id={q.id}
                        active={q.isActive}
                        editable={q.editable}
                        initial={{
                          title: q.title,
                          description: q.description ?? "",
                          category: q.category,
                          difficulty: q.difficulty,
                          estimatedMinutes: q.estimatedMinutes,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}
