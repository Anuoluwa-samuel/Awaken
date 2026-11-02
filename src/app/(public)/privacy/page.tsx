import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What AWAKEN collects, why, who processes it, how long it's kept and how to delete it.",
  path: "/privacy",
});

// Keep this in step with what the code actually stores: the schema in src/db/schema and the
// processors in docs/DEPLOYMENT.md. If a feature starts collecting something new, update this.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          AWAKEN is run by {LEGAL.operator}. This policy explains what we collect when you use AWAKEN, why, and the
          choices you have. The short version: we collect what the game needs to work, we don&apos;t sell it, and we
          don&apos;t use advertising or cross-site tracking.
        </>
      }
    >
      <h2>What we collect</h2>
      <h3>Your account</h3>
      <ul>
        <li>Your player name and email address.</li>
        <li>
          Your password, stored only as a one-way hash. We can&apos;t read it, and nobody at AWAKEN will ever ask you
          for it.
        </li>
        <li>Your settings: time zone, the hour your day starts, and the focus areas you choose.</li>
        <li>
          Your age range (13–17 or 18+, not your date of birth), whether a parent or guardian agreed for under-18s, and
          when you accepted these terms.
        </li>
      </ul>
      <h3>What you do in the game</h3>
      <ul>
        <li>
          Quests, habits, goals, milestones and focus sessions you create or complete, including any titles and notes
          you write.
        </li>
        <li>Your XP history, level, rank, attributes, skills, streaks, achievements and in-app notifications.</li>
      </ul>
      <p>
        All of this is self-reported: AWAKEN records what you tell it. It doesn&apos;t use your location, camera,
        microphone, contacts or health data.
      </p>
      <h3>Security records</h3>
      <ul>
        <li>For each signed-in session: your IP address and browser type, so you can be kept signed in safely.</li>
        <li>Short-lived counters keyed by IP address that limit how often sign-up and sign-in can be tried.</li>
        <li>
          A count of recent wrong passwords for an email address, used to pause sign-in after repeated failures.
        </li>
      </ul>

      <h2>What other players can see</h2>
      <p>
        If you&apos;re on the global leaderboard, other signed-in players can see your display name, title, level, rank
        and XP. They never see your email or your individual quests, habits and goals. Players aged 18 and over are
        listed by default, and under-18s are hidden unless they choose to join. You can change this at any time in
        Settings.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run your account and the game: generating quests on your own clock and calculating your progress.</li>
        <li>To keep accounts secure: preventing password guessing, spam sign-ups and abuse.</li>
        <li>To send emails you need, such as confirming your address or resetting your password.</li>
        <li>
          To understand how AWAKEN is used, through site-wide totals such as sign-ups and quests completed. Our admin
          dashboard shows only these totals, not individual players.
        </li>
      </ul>
      <p>
        We process your data because it&apos;s needed to provide the service you signed up for, and, for the security
        records, because we have a legitimate interest in protecting your account and the service.
      </p>
      <p>
        We don&apos;t sell your data, share it with advertisers, build advertising profiles or use it to train AI
        models.
      </p>

      <h2>Site analytics</h2>
      <p>
        To see which pages are used and how fast they load, we use Vercel Web Analytics and Speed Insights. They
        count page views and measure loading times without cookies, without recording what you type or how you
        move around a page (no session replays), and without identifying you across other websites. Before anything
        is sent, we strip personal details from page addresses: email addresses, password-reset links and the ids of
        your quests, habits and goals. Visitors are counted using a short-lived hash that changes every day.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        AWAKEN sets one essential cookie that keeps you signed in. It&apos;s removed when you sign out and expires
        after 14 days without use. A second small cookie remembers whether you collapsed the sidebar, and stays for up
        to a year. Neither is used for tracking. The focus timer remembers a suggested break in your browser&apos;s local storage;
        that never leaves your device. We use no advertising or third-party tracking cookies.
      </p>

      <h2>Who processes it for us</h2>
      <p>We use a small number of providers to run AWAKEN. They handle your data only on our instructions:</p>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the app, keeps short-lived request logs and provides the cookie-free site
          analytics described above.
        </li>
        <li>
          <strong>Neon</strong> hosts the database and a separate backup copy, in the United States.
        </li>
        <li>
          <strong>GitHub</strong> stores encrypted database backups for up to 30 days.
        </li>
        <li>
          <strong>Resend</strong> delivers account emails, when email is switched on.
        </li>
      </ul>
      <p>
        These providers may process data outside your country. They protect it under their own data processing terms,
        including standard contractual clauses where the law requires them.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          Account and game data: until you delete your account. Deletion is immediate. Encrypted backups, kept only
          to recover from data loss, are removed within 30 days.
        </li>
        <li>Sessions: until you sign out, or 14 days after you last used AWAKEN.</li>
        <li>Rate-limit counters: minutes. Wrong-password counts: cleared when you sign in or reset your password.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can see and change your name, time zone and focus areas in Settings, and all your game data is shown in
        the app. You can <strong>delete your account</strong> at any time from Settings: it immediately and
        permanently removes your account and everything linked to it. To ask for a copy of your data, or for anything
        else about it, <Contact /> from the email address on your account. We&apos;ll reply within 30 days.
      </p>
      <p>
        Depending on where you live, you may also have the right to object to or restrict how we use your data, and to
        complain to your data protection authority.
      </p>

      <h2>Security</h2>
      <p>
        Connections are encrypted with HTTPS, passwords are hashed, each player&apos;s records are isolated from
        everyone else&apos;s, and sign-in pauses after repeated wrong passwords. No system is perfectly secure; if we
        learn of a breach affecting your data, we&apos;ll tell you without undue delay.
      </p>

      <h2>Age</h2>
      <p>
        AWAKEN is for people aged {LEGAL.minimumAge} and over. If you are under 18, please use AWAKEN with the
        permission of a parent or guardian. If you believe a child under {LEGAL.minimumAge} has created an account,{" "}
        <Contact /> and we&apos;ll delete it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy, we&apos;ll update the date at the top. If a change affects how we use data you&apos;ve
        already given us, we&apos;ll tell you in the app before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        For anything about your data, <Contact />. See also the <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
