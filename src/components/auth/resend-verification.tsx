"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <div className="grid gap-3">
      {state === "sent" ? <FormMessage tone="success">A new link has been sent.</FormMessage> : null}
      {state === "error" ? <FormMessage tone="error">Couldn&apos;t send right now. Try again shortly.</FormMessage> : null}
      <Button
        variant="outline"
        disabled={state === "sending" || state === "sent"}
        onClick={async () => {
          setState("sending");
          const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" });
          setState(error ? "error" : "sent");
        }}
      >
        {state === "sending" ? "Sending…" : "Resend verification email"}
      </Button>
    </div>
  );
}
