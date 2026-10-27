"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { registerSchema } from "@/lib/validation/auth";

export function RegisterForm({ requireVerification }: { requireVerification: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    setError(null);
    const { error } = await authClient.signUp.email({ name, email, password, callbackURL: "/onboarding" });
    if (error) {
      // Deliberately vague so the form can't be used to probe which emails are registered.
      setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
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
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2">
        <Sparkles aria-hidden />
        {isSubmitting ? "Initializing…" : "Awaken"}
      </Button>
    </form>
  );
}
