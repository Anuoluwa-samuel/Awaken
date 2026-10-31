import { ArrowRight, Flame, ScrollText, Shield, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/logo";
import { LegalFooter } from "@/components/legal/legal-page";
import { AccountDeletedNotice } from "@/components/player/account-deleted-notice";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { RANKS } from "@/lib/progression/config";

const FEATURES = [
  { icon: ScrollText, title: "Daily quests", text: "Your routines become quests that reset on your own clock, in your own time zone." },
  { icon: TrendingUp, title: "Earned progression", text: "Every point of XP is recorded in a ledger and calculated on the server. No shortcuts." },
  { icon: Flame, title: "Kind streaks", text: "Rest days are part of the plan. Missing a day never takes away what you've earned." },
  { icon: Shield, title: "Your data, isolated", text: "Each player's records are private and scoped to their account." },
];

export default function LandingPage() {
  return (
    <div className="system-grid min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Start</Link>
          </Button>
        </nav>
      </header>

      <main>
        <Suspense>
          <AccountDeletedNotice />
        </Suspense>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="animate-rise">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-glow">
              A system for real-life progress
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-wide sm:text-6xl">
              Level up the
              <br />
              life you&apos;re living.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-ink-muted">
              AWAKEN turns workouts, study sessions, creative work and good habits into quests. Complete them to earn
              experience, raise your attributes and climb from E-Rank upward.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Begin awakening <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">I have an account</Link>
              </Button>
            </div>
          </div>

          {/* Illustrative preview of the status window — not real player data. */}
          <Panel glow aria-label="Example status window" className="p-6">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-glow">
              Daily quest available
            </p>
            <p className="mt-3 font-display text-xl font-semibold">Read or study for 30 minutes</p>
            <p className="mt-1 text-sm text-ink-muted">Reward: +25 XP · +2 Intelligence</p>
            <div className="mt-6 flex items-end justify-between">
              <p className="font-display text-sm uppercase tracking-[0.2em] text-ink-muted">
                Level <span className="ml-1 font-mono text-3xl text-ink">7</span>
              </p>
              <p className="font-mono text-xs text-ink-muted">88 / 220 XP</p>
            </div>
            <ProgressBar className="mt-2" value={88 / 220} label="Example experience bar" />
            <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Ranks">
              {RANKS.map((r) => (
                <li key={r.id} className="rounded border border-line px-2 py-0.5 font-display text-[11px] tracking-wider text-ink-muted">
                  {r.label}
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <h2 id="features" className="sr-only">
            Features
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Panel className="h-full p-5">
                  <Icon aria-hidden className="size-5 text-glow" />
                  <h3 className="mt-3 font-display font-semibold tracking-wide">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{text}</p>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
