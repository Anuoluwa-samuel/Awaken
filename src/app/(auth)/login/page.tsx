import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { FormMessage } from "@/components/ui/field";
import { getSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/validation/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getSession()) redirect(next);

  return (
    <AuthCard
      eyebrow="Player authentication"
      title="Welcome back, Player"
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Link href="/register" className="text-glow hover:underline">
            Create an account
          </Link>
          <Link href="/forgot-password" className="hover:text-ink hover:underline">
            Forgot password?
          </Link>
        </div>
      }
    >
      {params.reset === "1" ? (
        <div className="mb-4">
          <FormMessage tone="success">Password updated. Sign in with your new password.</FormMessage>
        </div>
      ) : null}
      <LoginForm next={next} />
    </AuthCard>
  );
}
