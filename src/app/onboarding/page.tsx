import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PRIVATE_PAGE } from "@/lib/site";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { db } from "@/db";
import { playerProfile } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Player setup", ...PRIVATE_PAGE };

export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = await db.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, user.id),
    columns: { userId: true },
  });
  if (existing) redirect("/system");

  return (
    <div className="system-grid min-h-dvh px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Wordmark className="mb-10" />
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">System initialized</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-wide sm:text-4xl">Configure your player</h1>
        <p className="mt-3 max-w-prose text-ink-muted">
          Tell the System how you want to grow. Everything here can be changed later in Settings —
          or skip and use sensible defaults.
        </p>
        <OnboardingForm defaultName={user.name} />
      </div>
    </div>
  );
}
