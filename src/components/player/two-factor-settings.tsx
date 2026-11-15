"use client";

import { Check, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth/client";

type Step = "off" | "password" | "confirm" | "on" | "disable";

/** Extracts the base32 secret from an otpauth:// URI, for apps that want manual entry. */
function manualKey(totpURI: string) {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

/** Enable/disable TOTP two-factor authentication from Settings. */
export function TwoFactorSettings({ initiallyEnabled, hasPassword }: { initiallyEnabled: boolean; hasPassword: boolean }) {
  const [step, setStep] = useState<Step>(initiallyEnabled ? "on" : "off");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnable() {
    setError(null);
    setBusy(true);
    const { data, error } = await authClient.twoFactor.enable({ password: password || undefined, method: "totp" });
    setBusy(false);
    if (error || !data || data.method !== "totp") {
      setError(error?.code === "INVALID_PASSWORD" ? "That password isn't right." : "Couldn't start setup. Try again.");
      return;
    }
    setSetup({ totpURI: data.totpURI, backupCodes: data.backupCodes });
    setStep("confirm");
  }

  async function confirmEnable() {
    setError(null);
    setBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error) {
      setError("That code didn't match. Check the time on your phone and try again.");
      return;
    }
    setStep("on");
  }

  async function disable() {
    setError(null);
    setBusy(true);
    const { error } = await authClient.twoFactor.disable({ password: password || undefined });
    setBusy(false);
    if (error) {
      setError(error.code === "INVALID_PASSWORD" ? "That password isn't right." : "Couldn't turn it off. Try again.");
      return;
    }
    setPassword("");
    setStep("off");
  }

  if (step === "on") {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm text-success">
          <ShieldCheck className="size-4" /> Two-factor authentication is on.
        </p>
        <Button type="button" variant="danger" size="sm" className="w-fit" onClick={() => setStep("disable")}>
          <ShieldOff /> Turn off
        </Button>
      </div>
    );
  }

  if (step === "disable") {
    return (
      <div className="grid gap-3">
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {hasPassword ? (
          <Field id="2fa-disable-password" label="Confirm your password">
            <PasswordInput id="2fa-disable-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="danger" size="sm" disabled={busy} onClick={disable}>
            {busy ? "Turning off…" : "Confirm: turn off 2FA"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("on")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === "confirm" && setup) {
    return (
      <div className="grid gap-4">
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <div>
          <p className="text-sm text-ink-muted">
            Scan this with your authenticator app, or enter the key manually, then enter the 6-digit code it shows.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded border border-line bg-surface px-2 py-1 font-mono text-sm tracking-wider">
              {manualKey(setup.totpURI)}
            </code>
            <CopyButton value={manualKey(setup.totpURI)} label="Copy key" />
          </div>
        </div>
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Backup codes</p>
          <p className="mt-1 text-xs text-ink-faint">
            Save these somewhere safe — each works once if you lose access to your authenticator app. They won&apos;t be
            shown again.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-md border border-line bg-surface p-3 font-mono text-sm">
            {setup.backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="mt-2">
            <CopyButton value={setup.backupCodes.join("\n")} label="Copy all codes" />
          </div>
        </div>
        <Field id="2fa-code" label="6-digit code">
          <Input
            id="2fa-code"
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={busy || code.length === 0} onClick={confirmEnable}>
            {busy ? "Confirming…" : "Confirm and turn on"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("off")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === "password") {
    return (
      <div className="grid gap-3">
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Field id="2fa-password" label="Confirm your password">
          <PasswordInput id="2fa-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={busy || password.length === 0} onClick={startEnable}>
            {busy ? "Starting…" : "Continue"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep("off")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <p className="text-sm text-ink-muted">
        Add a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password, …).
      </p>
      <Button
        type="button"
        size="sm"
        className="w-fit"
        onClick={() => (hasPassword ? setStep("password") : startEnable())}
      >
        <ShieldCheck /> Enable two-factor authentication
      </Button>
    </div>
  );
}
