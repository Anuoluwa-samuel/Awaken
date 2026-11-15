import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ConsentForm } from "@/components/auth/consent-form";
import { getSession } from "@/lib/auth/session";
import { PRIVATE_PAGE } from "@/lib/site";

export const metadata: Metadata = { title: "One more thing", ...PRIVATE_PAGE };

export default async function ConsentPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = session.user as typeof session.user & { termsAcceptedAt?: Date | string | null };
  if (user.termsAcceptedAt) redirect("/onboarding");

  return (
    <AuthCard eyebrow="Almost there" title="One more thing" description="A couple of quick questions before you begin.">
      <ConsentForm />
    </AuthCard>
  );
}
