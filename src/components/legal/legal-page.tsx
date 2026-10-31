import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";
import { LEGAL, legalUpdatedLabel } from "@/lib/legal";

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="system-grid min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="rounded-md" aria-label="AWAKEN home">
          <Wordmark />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-wide sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-faint">Last updated {legalUpdatedLabel()}</p>
        <div className="legal-prose mt-8">
          <p className="text-ink">{intro}</p>
          {children}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t border-line py-6 text-center text-xs text-ink-faint ${className}`}>
      <nav aria-label="Legal" className="flex justify-center gap-4">
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
      </nav>
      <p className="mt-2">Attributes are game mechanics, not measurements of ability or health.</p>
    </footer>
  );
}

/** "email us at x" when an address is configured, otherwise a plain description. */
export function Contact() {
  return LEGAL.contactEmail ? (
    <>
      email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
    </>
  ) : (
    <>contact {LEGAL.operator}</>
  );
}
