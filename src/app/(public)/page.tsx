import { ArrowRight, Flame, ScrollText, Shield, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/logo";
import { LegalFooter } from "@/components/legal/legal-page";
import { AccountDeletedNotice } from "@/components/player/account-deleted-notice";
import { JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { RANKS } from "@/lib/progression/config";
import { pageMetadata, SITE } from "@/lib/site";
import { softwareApplicationSchema } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({ description: SITE.description, path: "/" });

const REASSURANCE = "Free. Takes about a minute. No card, no app to install.";

const STEPS = [
  { title: "Pick your focus", text: "Choose what you're working on: fitness, learning, career, creativity and more." },
  { title: "Get daily quests", text: "A short set of quests appears each day, timed to your own clock." },
  { title: "Earn your rank", text: "Complete them for XP, attributes and streaks, and climb from E-Rank upward." },
];

const FEATURES = [
  { icon: ScrollText, title: "Daily quests", text: "Your routines become quests that reset on your own clock, in your own time zone." },
  { icon: TrendingUp, title: "Earned progression", text: "Every point of XP is recorded in a ledger and calculated on the server. No shortcuts." },
  { icon: Flame, title: "Kind streaks", text: "Rest days are part of the plan. Missing a day never takes away what you've earned." },
  { icon: Shield, title: "Your data, isolated", text: "Each player's records are private and scoped to their account." },
];

export default function LandingPage() {
  return (
    <div className="system-grid min-h-dvh">
      <JsonLd data={softwareApplicationSchema()} />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/guide">Guide</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Start free</Link>
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
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/register">
                  Begin awakening <ArrowRight aria-hidden />
                </Link>
              </Button>
              <p className="mt-3 text-sm text-ink-muted">{REASSURANCE}</p>
              <p className="mt-1 text-sm text-ink-muted">
                Already a player?{" "}
                <Link href="/login" className="text-glow hover:underline">
                  Sign in
                </Link>
              </p>
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

        <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 id="how" className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-glow">
            How it works
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-md border border-line-strong font-mono text-sm text-glow"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display font-semibold tracking-wide">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
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

        <section aria-labelledby="closing" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <Panel glow className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="closing" className="font-display text-2xl font-bold tracking-wide">
                Your first quest is waiting.
              </h2>
              <p className="mt-1 text-sm text-ink-muted">{REASSURANCE}</p>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link href="/register">
                Begin awakening <ArrowRight aria-hidden />
              </Link>
            </Button>
          </Panel>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
