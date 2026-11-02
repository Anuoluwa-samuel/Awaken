import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/db";
import { env } from "@/lib/env";
import { EMAILS_PER_RECIPIENT_PER_DAY } from "@/lib/limits";
import { consumeDaily, countSiteEvent, SITE_SCOPE } from "@/server/services/limits";

export type Mail = { to: string; subject: string; text: string };

/**
 * Transports:
 * - Resend, when RESEND_API_KEY + EMAIL_FROM are set (production);
 * - the dev-server console in development, so links can be followed locally;
 * - otherwise sending throws rather than pretending an email went out.
 */
export const emailTransport: "resend" | "console" | "none" = env.RESEND_API_KEY
  ? "resend"
  : process.env.NODE_ENV !== "production"
    ? "console"
    : "none";
export const emailTransportAvailable = emailTransport !== "none";

export async function sendEmail(mail: Mail): Promise<void> {
  if (emailTransport === "resend") return sendWithResend(mail, env.RESEND_API_KEY!, env.EMAIL_FROM!);
  if (emailTransport === "console") {
    console.info(
      `\n┌─ [AWAKEN mail] to: ${mail.to}\n│ ${mail.subject}\n│\n${mail.text
        .split("\n")
        .map((l) => `│ ${l}`)
        .join("\n")}\n└─\n`,
    );
    return;
  }
  throw new Error("No email transport configured. Set RESEND_API_KEY and EMAIL_FROM (see docs/DEPLOYMENT.md).");
}

/** Resend's REST API (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendWithResend(mail: Mail, apiKey: string, from: string, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Status only: the response body can echo addresses, and keys must never reach logs.
    throw new Error(`Email provider rejected the message (HTTP ${res.status}).`);
  }
}

/**
 * Sends an account email within the budgets: a per-recipient daily limit, so nobody's inbox can be
 * flooded, and a site-wide daily limit, so a flood can't run up a bill. Over budget, the email is
 * skipped and logged: the same reply goes back either way, so it reveals nothing about an account.
 */
export async function sendBudgetedEmail(mail: Mail): Promise<boolean> {
  const recipient = createHmac("sha256", env.BETTER_AUTH_SECRET).update(mail.to.trim().toLowerCase()).digest("base64url");
  const allowed =
    (await consumeDaily(db, `email:${recipient}`, "emails_sent", EMAILS_PER_RECIPIENT_PER_DAY)) &&
    (await consumeDaily(db, SITE_SCOPE, "emails_sent", env.EMAIL_DAILY_BUDGET));
  if (!allowed) {
    console.warn("[email] skipped: over the daily budget");
    await countSiteEvent(db, "emails_skipped");
    return false;
  }
  await sendEmail(mail);
  return true;
}
