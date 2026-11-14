"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

/** The second step of sign-in once a password was correct but the account has 2FA on. */
export function TwoFactorChallenge({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setBusy(false);
    if (error) {
      setError(error.code === "INVALID_BACKUP_CODE" || error.code === "INVALID_CODE" ? "That code didn't work. Try again." : "Something went wrong. Try again.");
      setCode("");
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <p className="text-sm text-ink-muted">
        {useBackupCode
          ? "Enter one of the backup codes you saved when you turned on two-factor authentication."
          : "Enter the 6-digit code from your authenticator app."}
      </p>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Input
        autoFocus
        inputMode={useBackupCode ? "text" : "numeric"}
        autoComplete="one-time-code"
        placeholder={useBackupCode ? "xxxx-xxxx" : "123456"}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={useBackupCode ? 20 : 6}
      />
      {!useBackupCode ? (
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="size-4 accent-[#2583ff]"
          />
          Trust this device for 30 days
        </label>
      ) : null}
      <Button type="submit" size="lg" disabled={busy || code.length === 0} className="mt-1">
        <ShieldCheck aria-hidden />
        {busy ? "Checking…" : "Verify"}
      </Button>
      <button
        type="button"
        onClick={() => {
          setUseBackupCode((v) => !v);
          setCode("");
          setError(null);
        }}
        className="text-center text-sm text-ink-muted hover:text-ink hover:underline"
      >
        {useBackupCode ? "Use your authenticator app instead" : "Use a backup code instead"}
      </button>
    </form>
  );
}
