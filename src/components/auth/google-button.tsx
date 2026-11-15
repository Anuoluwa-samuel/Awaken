"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/** Google's four-colour "G", inline so it never depends on an external icon font. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="size-4 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.1 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.9 37.6 46.5 31.6 46.5 24.5z"
      />
      <path fill="#FBBC05" d="M10.5 28.3c-.5-1.5-.8-3-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C1 15.9 0 19.8 0 23.5s1 7.6 2.6 11z" />
      <path
        fill="#34A853"
        d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.2-8.6 2.2-6.3 0-11.6-3.6-13.5-9.9l-7.9 6.1C6.5 41.6 14.6 47 24 47z"
      />
    </svg>
  );
}

/** "Continue with Google" — only rendered by the server when GOOGLE_CLIENT_ID is actually set. */
export function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        authClient.signIn.social({ provider: "google", callbackURL: next });
      }}
      className="inline-flex w-full items-center justify-center gap-2.5 rounded-md border border-line-strong bg-panel/60 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-glow disabled:opacity-60"
    >
      <GoogleMark />
      {busy ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}

export function OrDivider() {
  return (
    <div role="separator" aria-label="or" className="my-4 flex items-center gap-3 text-xs text-ink-faint">
      <span className="h-px flex-1 bg-line" aria-hidden />
      or
      <span className="h-px flex-1 bg-line" aria-hidden />
    </div>
  );
}
