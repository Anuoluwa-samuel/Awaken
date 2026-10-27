"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { onboardingSchema } from "@/lib/validation/player";
import { createPlayer } from "@/server/services/player";

export type OnboardingState = { error: string | null };

export async function completeOnboarding(input: unknown): Promise<OnboardingState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Some settings were invalid. Check the highlighted fields." };
  }
  await createPlayer(db, user.id, parsed.data);
  redirect("/system?welcome=1");
}
