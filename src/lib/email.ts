import "server-only";
import { env } from "@/lib/env";

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
