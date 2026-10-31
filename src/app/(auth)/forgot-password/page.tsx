import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotForm } from "@/components/auth/forgot-form";
import { FormMessage } from "@/components/ui/field";
import { emailTransportAvailable } from "@/lib/email";

export const metadata: Metadata = { title: "Reset password" };
// Decided per request: whether email can be sent depends on deployment settings.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Reset your password"
      description={
        emailTransportAvailable ? "Enter your account email and we'll send a reset link." : undefined
      }
      footer={
        <Link href="/login" className="text-glow hover:underline">
          Back to sign in
        </Link>
      }
    >
      {emailTransportAvailable ? (
        <ForgotForm />
      ) : (
        <FormMessage tone="info">
          Password reset by email isn&apos;t available on this server yet — email sending hasn&apos;t been set up.
          If you&apos;re locked out, contact whoever runs this AWAKEN instance.
        </FormMessage>
      )}
    </AuthCard>
  );
}
