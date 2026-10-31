import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { CompletionProvider } from "@/components/quests/completion-provider";
import { MobileNav, SidebarNav } from "@/components/shell/nav-links";
import { PlayerSummary } from "@/components/shell/player-summary";
import { ProfileMenu } from "@/components/shell/profile-menu";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { getPlayerContext } from "@/server/player-context";
import { getShellSummary } from "@/server/services/dashboard";
import { listNotifications } from "@/server/services/notifications";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function SystemLayout({ children }: LayoutProps<"/system">) {
  const { user, profile, today } = await getPlayerContext();
  const [summary, latest] = await Promise.all([
    getShellSummary(db, user.id, today),
    listNotifications(db, user.id, { limit: 6 }),
  ]);

  return (
    <CompletionProvider>
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-glow px-3 py-2 text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface/60 p-4 backdrop-blur lg:flex">
        <Link href="/system" className="rounded-md px-1" aria-label="AWAKEN status">
          <Wordmark />
        </Link>
        <PlayerSummary name={profile.displayName} summary={summary} />
        <SidebarNav unread={summary.unreadNotifications} />
        <p className="mt-auto px-1 text-[11px] leading-relaxed text-ink-faint">
          Quest day {today} · {profile.timeZone.replaceAll("_", " ")}
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur sm:px-6">
          <Link href="/system" className="rounded-md lg:hidden" aria-label="AWAKEN status">
            <Wordmark />
          </Link>
          <div className="hidden items-center gap-2 text-sm text-ink-muted lg:flex">
            <Badge tone="glow">LV {summary.level.level}</Badge>
            <Badge tone="arcane">{summary.rank.rank.label}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/system/quests"
              className="hidden items-center gap-2 rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted hover:border-line-strong hover:text-ink sm:flex"
            >
              <span className="font-display font-semibold uppercase tracking-wider">Quests</span>
              <span className="font-mono text-ink">{summary.questsOpen}</span>
              <span className="sr-only">open today</span>
            </Link>
            <NotificationBell latest={latest.items} unread={summary.unreadNotifications} />
            <ProfileMenu name={profile.displayName} initials={initials(profile.displayName) || "P"} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileNav unread={summary.unreadNotifications} />
    </div>
    </CompletionProvider>
  );
}
