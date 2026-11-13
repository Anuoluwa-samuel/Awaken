import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SeriesBarChart } from "@/components/analytics/charts";
import { Wordmark } from "@/components/brand/logo";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { CATEGORIES, CATEGORY_INFO, RANKS } from "@/lib/progression/config";
import { PRIVATE_PAGE } from "@/lib/site";
import { cachedRead } from "@/server/read-cache";
import { ADMIN_TREND_DAYS, getAdminAnalytics } from "@/server/services/admin-analytics";

export const metadata: Metadata = { title: "Admin dashboard", ...PRIVATE_PAGE };

const fmt = new Intl.NumberFormat("en-US");
const pct = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel/80 px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold">{value}</dd>
      {hint ? <dd className="text-[11px] text-ink-faint">{hint}</dd> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-3">
      <h2 className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">{title}</h2>
      {children}
    </section>
  );
}

function Trend({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel>
      <PanelHeader eyebrow={`Last ${ADMIN_TREND_DAYS} days (UTC)`} title={title} />
      <div className="p-4">{children}</div>
    </Panel>
  );
}

/** A labelled table with inline bars: readable as numbers, and needs no legend. */
function Breakdown({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <Panel>
      <PanelHeader eyebrow="Breakdown" title={title} />
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-ink-muted">No data yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Share</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-0">
                <td className="py-2 pl-5 pr-3 text-ink-muted">{row.label}</td>
                <td className="w-1/3 py-2 pr-3">
                  <div aria-hidden className="h-1.5 rounded-sm" style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: "var(--color-series-1)" }} />
                  <span className="sr-only">{pct(row.value, total)}</span>
                </td>
                <td className="py-2 pr-5 text-right font-mono">{fmt.format(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

const rankName = (key: string | null) => RANKS.find((r) => r.id === key)?.label ?? "Unknown";
const categoryName = (key: string | null) =>
  (CATEGORIES as readonly string[]).includes(key ?? "") ? CATEGORY_INFO[key as (typeof CATEGORIES)[number]].label : "Unknown";
const ageName = (key: string | null) => (key === "adult" ? "18+" : key === "teen" ? "13–17" : "Not recorded");

export default async function AdminPage() {
  await requireAdmin();
  const a = await cachedRead("admin-analytics", () => getAdminAnalytics(db), Math.min(env.READ_CACHE_SECONDS, 60));

  return (
    <div className="system-grid min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/quests" className="text-glow hover:underline">
            Quest pool
          </Link>
          <Link href="/system" className="text-glow hover:underline">
            Back to the app
          </Link>
        </nav>
      </header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-16 pt-2 sm:px-6">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Admin</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Analytics dashboard</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Site-wide totals only, with no individual players&apos; data. Figures are live from the database. Page views
            and load speed are in Vercel Analytics.
          </p>
        </div>

        <Section title="Players">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Accounts" value={fmt.format(a.accounts.total)} hint={`${fmt.format(a.accounts.new7)} new in 7 days · ${fmt.format(a.accounts.new30)} in 30`} />
            <Tile label="Finished setup" value={pct(a.accounts.onboarded, a.accounts.total)} hint={`${fmt.format(a.accounts.onboarded)} players`} />
            <Tile label="Active today" value={fmt.format(a.active.day)} hint="earned XP in the last 24 hours" />
            <Tile label="Active this month" value={fmt.format(a.active.month)} hint={`${fmt.format(a.active.week)} in the last 7 days`} />
          </dl>
        </Section>

        <Section title="Retention">
          <dl className="grid grid-cols-3 gap-3">
            {a.retention.map((r) => (
              <Tile key={r.day} label={`After ${r.day} day${r.day === 1 ? "" : "s"}`} value={pct(r.returned, r.eligible)} hint={`${fmt.format(r.returned)} of ${fmt.format(r.eligible)} came back`} />
            ))}
          </dl>
        </Section>

        <Section title="Trends">
          <div className="grid gap-4 lg:grid-cols-2">
            <Trend title="Sign-ups">
              <SeriesBarChart data={a.trends.signups} dataKey="signups" name="Sign-ups" />
            </Trend>
            <Trend title="Active players">
              <SeriesBarChart data={a.trends.active} dataKey="active" name="Active players" />
            </Trend>
            <Trend title="Quests completed">
              <SeriesBarChart data={a.trends.completions} dataKey="completions" name="Quests completed" />
            </Trend>
          </div>
        </Section>

        <Section title="Activity, all time">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="XP earned" value={fmt.format(a.totals.xp)} />
            <Tile label="Quests completed" value={fmt.format(a.totals.quests)} />
            <Tile label="Habit check-ins" value={fmt.format(a.totals.habitCheckIns)} />
            <Tile label="Focus time" value={`${fmt.format(a.totals.focusHours)}h`} hint={`${fmt.format(a.totals.focusSessions)} full sessions`} />
            <Tile label="Goals completed" value={fmt.format(a.totals.goals)} />
            <Tile label="Achievements" value={fmt.format(a.totals.achievements)} />
            <Tile label="Skills unlocked" value={fmt.format(a.totals.skills)} />
            <Tile label="Average level" value={String(a.levels.average)} hint={`highest: ${a.levels.highest}`} />
          </dl>
        </Section>

        <Section title="Who plays and what they do">
          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="Players by rank" rows={a.distributions.ranks.map((r) => ({ label: rankName(r.key), value: r.value }))} />
            <Breakdown title="Quests completed by category" rows={a.distributions.categories.map((r) => ({ label: categoryName(r.key), value: r.value }))} />
            <Breakdown title="Focus areas chosen" rows={a.distributions.focusAreas.map((r) => ({ label: categoryName(r.key), value: r.value }))} />
            <Breakdown title="Most-earned achievements" rows={a.distributions.achievements.map((r) => ({ label: r.key ?? "Unknown", value: r.value }))} />
            <Breakdown title="Accounts by age group" rows={a.distributions.ageGroups.map((r) => ({ label: ageName(r.key), value: r.value }))} />
          </div>
        </Section>

        <Section title="Usage and cost, today (UTC)">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Emails sent" value={`${fmt.format(a.usage.emailsSent)}/${fmt.format(env.EMAIL_DAILY_BUDGET)}`} hint={`${fmt.format(a.usage.emailsSkipped)} skipped over budget`} />
            <Tile label="Sign-ups" value={`${fmt.format(a.usage.signups)}/${fmt.format(env.SIGNUP_DAILY_BUDGET)}`} hint="pauses at the daily budget" />
            <Tile label="Database size" value={`${Math.round((a.usage.databaseBytes / 1_048_576) * 10) / 10} MB`} hint="compare with your Neon plan's limit" />
            <Tile label="Actions rate-limited" value={fmt.format(a.usage.rateLimited)} hint="players going too fast" />
            <Tile label="Quotas reached" value={fmt.format(a.usage.quotaReached)} hint="daily creation limits hit" />
            <Tile label="Bookkeeping rows" value={fmt.format(a.usage.bookkeepingRows)} hint="limit counters, cleared daily" />
          </dl>
        </Section>

        <Section title="Community and security">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="On the leaderboard" value={pct(a.accounts.listedOnLeaderboard, a.accounts.onboarded)} hint={`${fmt.format(a.accounts.listedOnLeaderboard)} players opted in`} />
            <Tile label="Sign-ins locked now" value={fmt.format(a.security.lockedNow)} />
            <Tile label="Lockouts, last 30 days" value={fmt.format(a.security.lockouts30d)} hint="emails with repeated wrong passwords" />
          </dl>
        </Section>
      </main>
    </div>
  );
}
