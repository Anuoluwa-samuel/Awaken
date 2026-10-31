import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using AWAKEN: eligibility, your account, acceptable use and our responsibilities.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <>
          These terms are an agreement between you and {LEGAL.operator}, who run AWAKEN. By creating an account or using
          AWAKEN, you agree to them. If you don&apos;t agree, please don&apos;t use the service.
        </>
      }
    >
      <h2>1. Who can use AWAKEN</h2>
      <p>
        You must be at least {LEGAL.minimumAge} years old to create an account. If you are under 18, you need the
        permission of a parent or guardian. By signing up you confirm this, and that the information you give us is
        accurate.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Keep your password private. You&apos;re responsible for what happens under your account.</li>
        <li>One person, one account. Accounts can&apos;t be sold or transferred.</li>
        <li>
          If you think someone else has access to your account, change your password and <Contact /> right away.
        </li>
      </ul>

      <h2>3. What AWAKEN is, and isn&apos;t</h2>
      <p>
        AWAKEN is a game layer for your own goals. Progress is self-reported: XP, levels, ranks and attributes reflect
        what you record, not a measurement of your ability, fitness or health. Nothing in AWAKEN is medical,
        psychological, financial or professional advice. Check with a qualified professional before starting a new
        exercise or health routine, and rest when you need to.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>break the law, or use AWAKEN to harass, threaten or harm anyone;</li>
        <li>access another player&apos;s account or data, or try to;</li>
        <li>
          probe, scan or attack the service, get around its rate limits or sign-in protections, or interfere with how
          it runs;
        </li>
        <li>use bots or scripts to create accounts or to generate rewards;</li>
        <li>copy, resell or reverse-engineer the service, except where the law allows it.</li>
      </ul>

      <h2>5. Your content</h2>
      <p>
        Quests, goals, notes and anything else you write stay yours. You give us permission to store and process them
        only so we can run AWAKEN for you. Our <Link href="/privacy">Privacy Policy</Link> explains how we handle your
        data.
      </p>

      <h2>6. Our content</h2>
      <p>
        The AWAKEN name, logo, design, quest library and software belong to {LEGAL.operator}. You can use them only as
        part of using the service.
      </p>

      <h2>7. Changes and availability</h2>
      <p>
        We&apos;re improving AWAKEN all the time, so features, rewards and balancing may change. We aim to keep the
        service available but can&apos;t promise it will always be uninterrupted or free of errors. AWAKEN is free to
        use today. If we ever introduce paid features, we&apos;ll tell you first and won&apos;t charge you without your
        agreement.
      </p>

      <h2>8. Ending your account</h2>
      <p>
        You can stop using AWAKEN at any time and delete your account yourself from Settings. We may suspend or close an account
        that breaks these terms or puts the service or other players at risk. Where it&apos;s reasonable, we&apos;ll
        tell you why first.
      </p>

      <h2>9. Disclaimers and liability</h2>
      <p>
        AWAKEN is provided &ldquo;as is&rdquo;. To the extent the law allows, we make no promises beyond those in these
        terms, and we aren&apos;t liable for indirect or consequential losses, or for lost progress or data. Nothing in
        these terms limits liability that can&apos;t legally be limited, or your rights as a consumer under the law
        where you live.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        If we change these terms, we&apos;ll update the date at the top. For significant changes, we&apos;ll tell you
        in the app before they take effect. If you keep using AWAKEN after that, you accept the new terms.
      </p>

      {LEGAL.governingLaw ? (
        <>
          <h2>11. Governing law</h2>
          <p>
            These terms are governed by the laws of {LEGAL.governingLaw}, without affecting any mandatory consumer
            protections where you live.
          </p>
        </>
      ) : null}

      <h2>{LEGAL.governingLaw ? "12" : "11"}. Contact</h2>
      <p>
        Questions about these terms? Please <Contact />.
      </p>
    </LegalPage>
  );
}
