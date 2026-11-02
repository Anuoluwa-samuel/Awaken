import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";
import { LegalFooter } from "@/components/legal/legal-page";
import { Button } from "@/components/ui/button";
import { ACHIEVEMENTS, SKILLS } from "@/db/seed-data";
import { LOCKOUT } from "@/lib/auth/lockout-rules";
import { LEGAL } from "@/lib/legal";
import {
  ATTRIBUTES,
  ATTRIBUTE_INFO,
  CATEGORIES,
  CATEGORY_INFO,
  CUSTOM_XP_MAX_MULTIPLIER,
  CUSTOM_XP_MIN,
  DIFFICULTIES,
  DIFFICULTY_ATTRIBUTE_POINTS,
  DIFFICULTY_XP,
  FOCUS_RULES,
  GOAL_RULES,
  HABIT_RULES,
  LEVEL_CURVE,
  LIMITS,
  QUEST_LIMITS,
  RANKS,
  WEEKLY_XP_MULTIPLIER,
} from "@/lib/progression/config";
import { focusXp } from "@/lib/progression/focus";
import { xpToReach } from "@/lib/progression/levels";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Player guide",
  description: "How to use AWAKEN: set up your player, complete quests, build habits, earn XP and climb the ranks.",
  path: "/guide",
});

const SECTIONS = [
  ["quick-start", "Quick start"],
  ["setup", "Setting up your player"],
  ["day", "How your day works"],
  ["quests", "Daily quests"],
  ["custom", "Your own quests"],
  ["weekly", "Weekly challenges"],
  ["habits", "Habits"],
  ["focus", "Focus sessions"],
  ["goals", "Goals"],
  ["levels", "XP, levels and ranks"],
  ["attributes", "Attributes"],
  ["skills", "Skills"],
  ["achievements", "Achievements and titles"],
  ["progress", "Progress and notifications"],
  ["account", "Your account"],
  ["faq", "Common questions"],
] as const;

function Section({ id, children }: { id: (typeof SECTIONS)[number][0]; children: ReactNode }) {
  const title = SECTIONS.find(([key]) => key === id)![1];
  return (
    <section aria-labelledby={id} className="guide-section">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <table>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const capitalise = (word: string) => word[0]!.toUpperCase() + word.slice(1);

// Numbers come from the game's own config, so this page can't drift from the rules. The wording
// describes behaviour in src/server/services and docs/ARCHITECTURE.md: update it if those change.
export default function GuidePage() {
  return (
    <div className="system-grid min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="AWAKEN home">
          <Wordmark />
        </Link>
        <Button asChild size="sm" className="print:hidden">
          <Link href="/register">Start free</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-glow">Player guide</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-wide sm:text-4xl">How to use AWAKEN</h1>
        <div className="legal-prose mt-6">
          <p className="text-ink">
            AWAKEN turns the things you already want to do into a role-playing game. You complete quests in real life,
            mark them done, and earn experience that raises your level and rank. This guide explains how each part
            works and how to get the most from it.
          </p>

          <nav aria-label="On this page" className="guide-toc">
            <h2>On this page</h2>
            <ol>
              {SECTIONS.map(([id, title]) => (
                <li key={id}>
                  <a href={`#${id}`}>{title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <Section id="quick-start">
            <ol>
              <li>
                <strong>Create your account</strong> and set up your player. It takes about a minute.
              </li>
              <li>
                <strong>Open Quests</strong> and do one today. Pick the easiest one: a first win matters more than a big
                one.
              </li>
              <li>
                <strong>Press Complete</strong> when you&apos;ve really done it. You&apos;ll see your XP straight away.
              </li>
              <li>
                <strong>Add one habit</strong> you want to keep, such as a daily walk.
              </li>
              <li>
                <strong>Come back tomorrow.</strong> New daily quests will be waiting.
              </li>
            </ol>
          </Section>

          <Section id="setup">
            <p>The first time you sign in, AWAKEN asks you a few questions. You can change them later in Settings.</p>
            <ul>
              <li>
                <strong>Display name:</strong> what the System calls you.
              </li>
              <li>
                <strong>Time zone:</strong> decides when your day resets.
              </li>
              <li>
                <strong>New day begins at:</strong> the hour your day rolls over. The default is 4 AM, so a late night
                still counts toward the day you started it.
              </li>
              <li>
                <strong>Focus areas:</strong> what you&apos;re working on. These choose your starter quests and weekly
                challenges. The options are: {CATEGORIES.map((c) => CATEGORY_INFO[c].label.toLowerCase()).join(", ")}.
              </li>
              <li>
                <strong>Preferred difficulty:</strong> the default for quests you create.
              </li>
              <li>
                <strong>Daily quest target (optional):</strong> how many daily quests you want. You start with up to 5.
              </li>
            </ul>
          </Section>

          <Section id="day">
            <p>
              Everything in AWAKEN runs on <strong>your</strong> clock. Your day starts at the hour you chose, in your
              time zone, and weeks run Monday to Sunday.
            </p>
            <p>
              You can change your time zone or day start once every 7 days. The limit stops anyone earning extra daily
              quests by moving between time zones.
            </p>
          </Section>

          <Section id="quests">
            <p>
              Each day you get a fresh set of quests on the <strong>Quests</strong> page. Do the real-life task, then
              press <strong>Complete</strong>. You can also open a quest to read its details or add a note.
            </p>
            <Table
              caption="Rewards by quest difficulty"
              head={["Difficulty", "XP", "Attribute points"]}
              rows={DIFFICULTIES.map((d) => [capitalise(d), DIFFICULTY_XP[d], DIFFICULTY_ATTRIBUTE_POINTS[d]])}
            />
            <p>
              Finishing a scheduled daily quest on its day also earns +{LIMITS.dailyQuestDisciplineBonus} Discipline.
            </p>
            <p>
              <strong>Missed a quest?</strong> It expires when your day ends. You earn nothing for it, but you
              don&apos;t lose anything either. XP you&apos;ve earned can never be taken away.
            </p>
          </Section>

          <Section id="custom">
            <p>
              Go to <strong>Quests → New quest</strong> to add anything the daily list doesn&apos;t cover.
            </p>
            <ul>
              <li>
                <strong>One-time</strong> quests stay open until you finish or cancel them, or until their optional
                target date passes.
              </li>
              <li>
                <strong>Recurring</strong> quests appear on the days of the week you pick.
              </li>
              <li>
                <strong>Rewards</strong> default to the difficulty&apos;s XP. You can set your own, from {CUSTOM_XP_MIN}{" "}
                up to {CUSTOM_XP_MAX_MULTIPLIER}× the default. The reward is fixed when you create the quest.
              </li>
              <li>
                <strong>Checklists</strong> can break a quest into up to {QUEST_LIMITS.maxChecklistItems} steps.
              </li>
            </ul>
            <p>
              To keep the game fair, only {LIMITS.customCompletionsPerCategoryPerDay} custom quests per category earn
              rewards each day. Any more are still recorded, for 0 XP. You can have{" "}
              {QUEST_LIMITS.maxOpenCustomQuests} open one-time quests and {QUEST_LIMITS.maxRecurringCustomQuests}{" "}
              recurring quests. Quests can&apos;t be edited after creation, only cancelled.
            </p>
          </Section>

          <Section id="weekly">
            <p>
              Every Monday you get challenges based on your focus areas, plus &ldquo;Complete five planned tasks&rdquo;,
              which any quest counts toward. Progress moves as you complete quests, and the reward arrives the moment
              you hit the target.
            </p>
            <p>
              Rewards are {WEEKLY_XP_MULTIPLIER}× the difficulty&apos;s XP, so a hard challenge pays{" "}
              {DIFFICULTY_XP.hard * WEEKLY_XP_MULTIPLIER} XP, and they don&apos;t count toward your daily limit.
              Unfinished challenges end on Sunday.
            </p>
          </Section>

          <Section id="habits">
            <p>
              Habits are the small things you want to keep doing. Create one on the <strong>Habits</strong> page and
              choose a schedule:
            </p>
            <ul>
              <li>
                <strong>Specific days</strong>, such as weekdays. Other days are rest days and never break your streak.
              </li>
              <li>
                <strong>A number of times per week</strong>, on any days.
              </li>
            </ul>
            <p>
              Each check-in that counts toward your schedule earns {HABIT_RULES.xp} XP and {HABIT_RULES.attributePoints}{" "}
              attribute point. Check-ins on rest days or beyond your weekly target are recorded for no reward. You can
              check in once per habit per day.
            </p>
            <p>
              <strong>Streaks</strong> count scheduled days in a row, or weeks in a row for weekly habits. Today never
              counts as missed while it&apos;s still going. Missing a day can reset a streak, but it never costs XP, and
              your best streak stays on record.
            </p>
            <p>
              You can also link a habit to a daily quest: doing either one completes both, and you get the quest&apos;s
              reward once.
            </p>
          </Section>

          <Section id="focus">
            <p>
              The <strong>Focus</strong> page is a timer for concentrated work. Choose a length from{" "}
              {FOCUS_RULES.minMinutes} to {FOCUS_RULES.maxBaseMinutes} minutes (up to {FOCUS_RULES.maxDeepMinutes} with
              the Deep Focus skill) and press start.
            </p>
            <ul>
              <li>
                A full session earns about 2 XP for every 5 minutes (25 minutes = {focusXp(25 * 60)} XP) and +1
                Discipline.
              </li>
              <li>You can pause, but paused time doesn&apos;t count.</li>
              <li>Ending early earns no XP, though the time you focused is still recorded.</li>
              <li>Closing the tab or refreshing is safe. The timer keeps its place.</li>
              <li>
                Afterwards you&apos;ll be offered a {FOCUS_RULES.shortBreakMinutes}-minute break, or{" "}
                {FOCUS_RULES.longBreakMinutes} minutes after every {FOCUS_RULES.longBreakEvery}th session.
              </li>
            </ul>
            <p>
              You can link a session to an open quest. If the session is at least as long as the quest&apos;s estimate,
              finishing it completes the quest and you earn the quest&apos;s reward instead.
            </p>
          </Section>

          <Section id="goals">
            <p>
              Goals are bigger targets, such as &ldquo;Finish my portfolio&rdquo;. Break each one into{" "}
              {GOAL_RULES.minMilestones}–{GOAL_RULES.maxMilestones} milestones on the <strong>Goals</strong> page. Tick a
              milestone off yourself, or use <strong>Make quest</strong> to turn it into a quest.
            </p>
            <p>
              Finishing a goal earns {GOAL_RULES.xpPerMilestone} XP per milestone, up to {GOAL_RULES.maxXp} XP. The
              reward needs at least {GOAL_RULES.minMilestones} milestones and a goal created on an earlier day, and only{" "}
              {GOAL_RULES.maxRewardedPerDay} goals can earn rewards per day. The Goals page shows the reward before you
              start.
            </p>
          </Section>

          <Section id="levels">
            <p>
              XP adds up over your lifetime and never goes down. Your first level-up takes {LEVEL_CURVE.base} XP, and
              each level after that takes {LEVEL_CURVE.increment} XP more than the one before. Every level also gives
              you {LIMITS.skillPointsPerLevel} skill point.
            </p>
            <Table
              caption="Ranks and what they take"
              head={["Rank", "Reached at level", "Total XP"]}
              rows={RANKS.map((r) => [r.label, r.minLevel, xpToReach(r.minLevel).toLocaleString("en-US")])}
            />
            <p>
              <strong>Daily limits</strong> keep things balanced. Quests, habits and focus can earn up to{" "}
              {LIMITS.dailyQuestXpCap} XP per day, and each attribute can gain up to {LIMITS.dailyAttributeCap} points
              per day. Weekly challenges, goals and achievements aren&apos;t limited this way.
            </p>
          </Section>

          <Section id="attributes">
            <p>Each quest and habit raises an attribute. These are game stats, not measurements of you.</p>
            <Table
              caption="The five attributes"
              head={["Attribute", "Grows with"]}
              rows={ATTRIBUTES.map((a) => [ATTRIBUTE_INFO[a].label, ATTRIBUTE_INFO[a].blurb])}
            />
          </Section>

          <Section id="skills">
            <p>
              Spend skill points on the <strong>Skills</strong> page. Skills add new things to do rather than raw power.
              Some need another skill first.
            </p>
            <Table
              caption="Skills"
              head={["Skill", "What it does", "Level", "Cost"]}
              rows={SKILLS.map((s) => [s.name, s.description, s.requiredLevel, s.cost])}
            />
          </Section>

          <Section id="achievements">
            <p>
              Achievements unlock automatically, and some earn XP or a title. Choose which title to show on the{" "}
              <strong>Achievements</strong> page.
            </p>
            <Table
              caption="Achievements"
              head={["Achievement", "How to earn it", "Reward"]}
              rows={ACHIEVEMENTS.map((a) => [
                a.name,
                a.description,
                [a.xpReward ? `${a.xpReward} XP` : null, a.titleReward ? `“${a.titleReward}” title` : null]
                  .filter(Boolean)
                  .join(", "),
              ])}
            />
          </Section>

          <Section id="progress">
            <p>
              <strong>Status</strong> is your home screen: level, rank, attributes and recent activity.{" "}
              <strong>Progress</strong> shows charts of your XP, quests and focus time over 7 days up to a year.{" "}
              <strong>Notifications</strong> lists level-ups, rank-ups, reminders and security alerts inside the app.
              AWAKEN doesn&apos;t send push notifications.
            </p>
          </Section>

          <Section id="account">
            <ul>
              <li>
                <strong>Age:</strong> you must be {LEGAL.minimumAge} or older. If you&apos;re under 18, you need a
                parent&apos;s or guardian&apos;s permission.
              </li>
              <li>
                <strong>Wrong passwords:</strong> after {LOCKOUT.maxAttempts} wrong tries, sign-in pauses for{" "}
                {LOCKOUT.baseMinutes} minutes. If it keeps happening, each pause doubles, up to 24 hours. Signing in
                successfully clears the count.
              </li>
              <li>
                <strong>Forgotten password:</strong> use &ldquo;Forgot password?&rdquo; on the sign-in page. A reset also
                lifts any pause. If that page says resets aren&apos;t available yet, you&apos;ll need your current
                password, so keep it somewhere safe.
              </li>
              <li>
                <strong>Deleting your account:</strong> go to <strong>Settings → Delete account</strong>. It permanently
                removes your account and all your data straight away, and it can&apos;t be undone.
              </li>
            </ul>
            <p>
              See the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link> for the
              details.
            </p>
          </Section>

          <Section id="faq">
            <h3>Why did I get less XP than the quest said, or none?</h3>
            <p>
              You&apos;ve probably reached a limit: {LIMITS.dailyQuestXpCap} XP per day from quests, habits and focus, or{" "}
              {LIMITS.customCompletionsPerCategoryPerDay} rewarded custom quests per category. The System tells you when
              this happens. The limits reset when your new day starts.
            </p>
            <h3>I pressed Complete by mistake. Can I undo it?</h3>
            <p>Not at the moment. Completions are final, so check before you press.</p>
            <h3>I missed a few days. Have I lost progress?</h3>
            <p>
              No. Your XP, level and rank stay exactly where they were. A habit streak may restart, but your best streak
              stays on record. Just pick up with today&apos;s quests.
            </p>
            <h3>Does AWAKEN check that I really did the task?</h3>
            <p>
              No. Everything is self-reported, and the game only means something if you&apos;re honest with yourself.
            </p>
            <h3>I changed my focus areas. Why are my daily quests the same?</h3>
            <p>
              Focus areas choose your starter quests when you first set up, and your weekly challenges from then on.
              Changing them doesn&apos;t replace your existing daily quests. Add a custom recurring quest for anything
              new.
            </p>
            <h3>Is AWAKEN medical or fitness advice?</h3>
            <p>
              No. Attributes are game mechanics, not measurements of your ability or health. Check with a professional
              before starting a new exercise routine, and rest when you need to.
            </p>
          </Section>
        </div>

        <div className="mt-12 print:hidden">
          <Button asChild size="lg">
            <Link href="/register">
              Begin awakening <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </main>
      <LegalFooter className="print:hidden" />
    </div>
  );
}
