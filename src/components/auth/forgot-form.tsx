"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Captcha, captchaFetchOptions } from "@/components/auth/captcha";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { forgotSchema } from "@/lib/validation/auth";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
      ...captchaFetchOptions(captchaToken),
    });
    if (error) setCaptchaReset((n) => n + 1);
    if (error?.code === "CAPTCHA_REQUIRED" && error.message) {
      setError(error.message);
      return;
    }
    if (error?.status === 429) {
      setError("Too many requests. Try again in a few minutes.");
      return;
    }
    if (error?.code === "BOT_DETECTED" && error.message) {
      setError(error.message);
      return;
    }
    if (error && error.status >= 500) {
      setError("We couldn't send the email right now. Try again in a few minutes.");
      return;
    }
    // Same response whether or not the account exists.
    setSent(true);
  });

  if (sent) {
    return (
      <FormMessage tone="success">
        If an account exists for that email, a reset link is on its way. It expires in 30 minutes.
      </FormMessage>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      <Field id="email" label="Email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
