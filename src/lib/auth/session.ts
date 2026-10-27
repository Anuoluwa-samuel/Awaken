import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { playerProfile } from "@/db/schema";
import { auth } from "./server";

/** Validated session for this request, or null. Deduplicated per render. */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** The signed-in user. Redirects to /login otherwise. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

/** A signed-in user who has a player profile. Redirects to onboarding otherwise. */
export const requirePlayer = cache(async () => {
  const user = await requireUser();
  const profile = await db.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, user.id),
  });
  if (!profile) redirect("/onboarding");
  return { user, profile };
});
