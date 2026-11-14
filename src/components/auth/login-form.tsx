"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Captcha, captchaFetchOptions } from "@/components/auth/captcha";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { LockoutCountdown } from "./lockout-countdown";
import { TwoFactorChallenge } from "./two-factor-challenge";
import { loginSchema } from "@/lib/validation/auth";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  // Seconds left on an account lockout (null = not locked); `lockKey` restarts the countdown.
  const [lockedFor, setLockedFor] = useState<number | null>(null);
  const [lockKey, setLockKey] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const unlock = useCallback(() => setLockedFor(null), []);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { data, error } = await authClient.signIn.email({ ...values, ...captchaFetchOptions(captchaToken) });
    if (!error && (data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setNeedsTwoFactor(true);
      return;
    }
    if (error?.code === "CAPTCHA_REQUIRED") {
      // Only appears after repeated wrong passwords. Ask, then let them submit again.
      setShowCaptcha(true);
      setCaptchaReset((n) => n + 1);
      setError(error.message ?? "Please complete the check to continue.");
      return;
    }
    if (error) setCaptchaReset((n) => n + 1);
    if (error?.code === "ACCOUNT_LOCKED") {
      setLockedFor(Number((error as { retryAfterSeconds?: unknown }).retryAfterSeconds) || 600);
      setLockKey((k) => k + 1);
      return;
    }
    if (error) {
      setError(
        error.code === "EMAIL_NOT_VERIFIED"
          ? "Verify your email first — we've sent you a new link."
          : error.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : error.code === "BOT_DETECTED" && error.message
              ? error.message
              : "Invalid email or password.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  });

  if (needsTwoFactor) return <TwoFactorChallenge next={next} />;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {lockedFor ? <LockoutCountdown key={lockKey} seconds={lockedFor} onDone={unlock} /> : null}
      {error && !lockedFor ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Field id="email" label="Email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field id="password" label="Password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
      </Field>
      {showCaptcha ? <Captcha onToken={setCaptchaToken} resetKey={captchaReset} /> : null}
      <Button type="submit" size="lg" disabled={isSubmitting || !!lockedFor} className="mt-2">
        <LogIn aria-hidden />
        {isSubmitting ? "Connecting…" : "Enter the System"}
      </Button>
    </form>
  );
}
