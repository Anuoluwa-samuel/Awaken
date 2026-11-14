"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { submitConsentAction } from "@/app/(auth)/consent/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { LEGAL } from "@/lib/legal";
import { consentSchema } from "@/lib/validation/auth";

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

/** One-time finish-up for a Google sign-up: the age/Terms questions the email form asks at sign-up. */
export function ConsentForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof consentSchema>>({
    resolver: zodResolver(consentSchema),
    defaultValues: { guardianConsent: false, acceptTerms: false },
  });
  const { errors, isSubmitting } = form.formState;
  const ageAnswer = useWatch({ control: form.control, name: "ageAnswer" });
  const tooYoung = ageAnswer === "under13";

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const result = await submitConsentAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
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
        <ShieldCheck aria-hidden />
        {isSubmitting ? "Confirming…" : "Continue"}
      </Button>
    </form>
  );
}
