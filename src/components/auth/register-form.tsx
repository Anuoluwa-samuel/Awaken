"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { LEGAL } from "@/lib/legal";
import { registerSchema } from "@/lib/validation/auth";

const AGE_OPTIONS = [
  { value: "under13", label: `Under ${LEGAL.minimumAge}` },
  { value: "teen", label: `${LEGAL.minimumAge}–17` },
  { value: "adult", label: "18+" },
] as const;

function Checkbox({
  id,
  error,
  children,
  ...input
}: { id: string; error?: string; children: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-ink-muted">
        <input
          id={id}
          type="checkbox"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 accent-[#2583ff]"
          {...input}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RegisterForm({ requireVerification, formToken }: { requireVerification: boolean; formToken: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    // No age is preselected: a neutral question, so nobody is nudged toward "adult".
    defaultValues: { name: "", email: "", password: "", confirm: "", guardianConsent: false, acceptTerms: false },
  });
  const { errors, isSubmitting } = form.formState;
  const ageAnswer = useWatch({ control: form.control, name: "ageAnswer" });
  const tooYoung = ageAnswer === "under13";

  const onSubmit = form.handleSubmit(async ({ name, email, password, ageAnswer, guardianConsent, acceptTerms }, event) => {
    const website = (event?.target as HTMLFormElement | undefined)?.elements.namedItem("website");
    setError(null);
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/onboarding",
      // Checked again on the server (src/lib/auth/consent-rules.ts) and stamped onto the account.
      ...{ ageAnswer, guardianConsent: ageAnswer === "teen" && guardianConsent, acceptTerms },
      // Anti-spam (src/lib/auth/spam-rules.ts): the signed form token and the honeypot field.
      ...{ formToken, website: website instanceof HTMLInputElement ? website.value : "" },
    });
    if (error) {
      // Deliberately vague so the form can't be used to probe which emails are registered.
      setError(
        error.status === 429
          ? "Too many sign-ups from this network. Try again later."
          : (error.code === "DISPOSABLE_EMAIL" || error.code === "BOT_DETECTED") && error.message
            ? error.message
            : "We couldn't create that account. If you already have one, sign in instead.",
      );
      return;
    }
    if (requireVerification) {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } else {
      router.replace("/onboarding");
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {/* Honeypot: off-screen and skipped by keyboard and screen readers, so only bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <Field id="name" label="Player name" error={errors.name?.message}>
        <Input id="name" autoComplete="nickname" aria-invalid={!!errors.name} {...form.register("name")} />
      </Field>
      <Field id="email" label="Email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters." error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...form.register("password")}
        />
      </Field>
      <Field id="confirm" label="Confirm password" error={errors.confirm?.message}>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          {...form.register("confirm")}
        />
      </Field>
      <fieldset className="grid gap-2" aria-describedby={errors.ageAnswer ? "age-error" : undefined}>
        <legend className="mb-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          How old are you?
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {AGE_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className="relative flex cursor-pointer items-center justify-center gap-2 rounded-md border border-line px-2 py-2 text-sm text-ink-muted has-[:checked]:border-glow has-[:checked]:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-glow"
            >
              <input
                type="radio"
                value={value}
                className="absolute inset-0 cursor-pointer appearance-none rounded-md opacity-0"
                {...form.register("ageAnswer")}
              />
              {label}
            </label>
          ))}
        </div>
        {errors.ageAnswer && !tooYoung ? (
          <p id="age-error" role="alert" className="text-xs text-danger">
            {errors.ageAnswer.message}
          </p>
        ) : null}
      </fieldset>
      {tooYoung ? (
        <FormMessage tone="info">
          Sorry, you need to be {LEGAL.minimumAge} or older to use AWAKEN. Come back when you are. We&apos;ll be here.
        </FormMessage>
      ) : null}
      {ageAnswer === "teen" ? (
        <Checkbox id="guardianConsent" error={errors.guardianConsent?.message} {...form.register("guardianConsent")}>
          A parent or guardian has agreed to me using AWAKEN.
        </Checkbox>
      ) : null}
      <Checkbox id="acceptTerms" error={errors.acceptTerms?.message} {...form.register("acceptTerms")}>
        I agree to the{" "}
        <Link href="/terms" target="_blank" className="text-glow hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="text-glow hover:underline">
          Privacy Policy
        </Link>
        .
      </Checkbox>
      <Button type="submit" size="lg" disabled={isSubmitting || tooYoung} className="mt-2">
        <Sparkles aria-hidden />
        {isSubmitting ? "Initializing…" : "Awaken"}
      </Button>
    </form>
  );
}
