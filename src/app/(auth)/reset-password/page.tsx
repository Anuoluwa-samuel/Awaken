import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/reset-form";
import { FormMessage } from "@/components/ui/field";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  const valid = typeof token === "string" && token.length > 0 && !error;
  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Choose a new password"
      footer={
        <Link href="/forgot-password" className="text-glow hover:underline">
          Request a new link
        </Link>
      }
    >
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <FormMessage tone="error">This reset link is invalid or has expired.</FormMessage>
      )}
    </AuthCard>
  );
}
