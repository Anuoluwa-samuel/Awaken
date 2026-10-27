import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/system");
  return (
    <AuthCard
      eyebrow="New player detected"
      title="Begin your awakening"
      description="Create an account to start turning real progress into levels."
      footer={
        <>
          Already a player?{" "}
          <Link href="/login" className="text-glow hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm requireVerification={env.REQUIRE_EMAIL_VERIFICATION} />
    </AuthCard>
  );
}
