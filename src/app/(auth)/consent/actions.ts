"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { checkSignUpConsent, type ConsentBody } from "@/lib/auth/consent-rules";
import { LEGAL } from "@/lib/legal";
import { getSession } from "@/lib/auth/session";
import { guardAction } from "@/server/guards";

export type ConsentActionResult = { ok: true } | { ok: false; error: string };

/**
 * Finishes sign-up for a Google account: the same age/Terms consent the email form collects
 * synchronously (src/lib/auth/consent-rules.ts), stamped on here instead. Deliberately not
 * `requireUser()` — that redirects *to* this page when consent is missing, which is exactly the
 * case this runs in.
 */
export async function submitConsentAction(input: unknown): Promise<ConsentActionResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (await guardAction(session.user.id)) return { ok: false, error: "Slow down a little and try again." };

  const consent = checkSignUpConsent(input as ConsentBody | undefined);
  if (!consent.ok) return { ok: false, error: consent.message };

  await db
    .update(userTable)
    .set({ ageGroup: consent.ageGroup, termsAcceptedAt: new Date(), termsVersion: LEGAL.updated })
    .where(eq(userTable.id, session.user.id));
  return { ok: true };
}
