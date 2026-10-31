"use client";

import "./globals.css";

// Last-resort boundary for errors in the root layout. Shows nothing about the error itself
// (production builds already strip messages; the digest lets logs be matched).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-bg px-4 text-ink">
        <main className="max-w-md rounded-lg border border-line bg-panel p-8 text-center">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-warning">System error</p>
          <h1 className="mt-2 text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-muted">Your progress is safe — nothing was lost. Please try again.</p>
          {error.digest ? <p className="mt-3 font-mono text-xs text-ink-faint">Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md border border-line-strong px-4 py-2 text-sm hover:border-glow"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
