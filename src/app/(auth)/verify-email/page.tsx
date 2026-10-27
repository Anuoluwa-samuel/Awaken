import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { z } from "zod";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { email } = await searchParams;
  const parsed = z.string().email().safeParse(email);
  return (
    <AuthCard
      eyebrow="Verification pending"
      title="Check your inbox"
      description={
        <>
          We sent a verification link{parsed.success ? <> to <strong className="text-ink">{parsed.data}</strong></> : null}.
          Open it to activate your account.
        </>
      }
      footer={
        <Link href="/login" className="text-glow hover:underline">
          Back to sign in
        </Link>
      }
    >
      {parsed.success ? <ResendVerification email={parsed.data} /> : null}
    </AuthCard>
  );
}
