import "server-only";

type Mail = { to: string; subject: string; text: string };

/**
 * Development: emails are printed to the server console so links can be followed locally.
 * Production: no provider is wired up yet, so sending throws rather than pretending.
 * Add a provider (Resend, SES, SMTP…) here before enabling verification in production.
 */
export const emailTransportAvailable = process.env.NODE_ENV !== "production";

export async function sendEmail(mail: Mail): Promise<void> {
  if (!emailTransportAvailable) {
    throw new Error("No email transport configured. See src/lib/email.ts.");
  }
  console.info(
    `\n┌─ [AWAKEN mail] to: ${mail.to}\n│ ${mail.subject}\n│\n${mail.text
      .split("\n")
      .map((l) => `│ ${l}`)
      .join("\n")}\n└─\n`,
  );
}
