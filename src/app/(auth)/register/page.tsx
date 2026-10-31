import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getSession } from "@/lib/auth/session";
import { issueFormToken } from "@/lib/auth/spam-rules";
import { env } from "@/lib/env";

export const metadata: Metadata = pageMetadata({
  title: "Create account",
  description: "Create a free AWAKEN account and turn your routines into quests that earn XP, levels and ranks.",
  path: "/register",
});

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
      <RegisterForm
        requireVerification={env.REQUIRE_EMAIL_VERIFICATION}
        formToken={issueFormToken(env.BETTER_AUTH_SECRET)}
      />
    </AuthCard>
  );
}
