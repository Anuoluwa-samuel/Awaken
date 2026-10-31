"use client";

import { useEffect, useState } from "react";
import { FormMessage } from "@/components/ui/field";
import { formatClock } from "@/lib/progression/focus";

/** Live countdown for a locked sign-in; calls onDone when the lock has expired. */
export function LockoutCountdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    // Deadline from the wall clock, so a throttled background tab still ends on time.
    const until = Date.now() + seconds * 1000;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(id);
        onDone();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, onDone]);

  return (
    <FormMessage tone="error">
      <span className="block font-medium">Sign-in paused after too many wrong passwords.</span>
      <span className="mt-1 block">
        Try again in <span className="font-mono tabular-nums" aria-hidden>{formatClock(left)}</span>
        <span className="sr-only">{Math.ceil(left / 60)} minutes</span>. Forgot it?{" "}
        <a href="/forgot-password" className="underline">
          Reset your password
        </a>{" "}
        to unlock right away.
      </span>
    </FormMessage>
  );
}
