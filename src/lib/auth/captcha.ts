/** Header the auth forms use to send the captcha token. */
export const CAPTCHA_HEADER = "x-captcha-token";

/** Wrong passwords for an email before sign-in starts asking for a captcha. */
export const CAPTCHA_AFTER_FAILED_SIGN_INS = 3;

export type CaptchaResult = "ok" | "missing" | "rejected" | "unavailable";

/**
 * Checks a Cloudflare Turnstile token server-side. "unavailable" means Cloudflare couldn't answer:
 * callers let the request through, because rate limits and lockout still apply, and an outage at a
 * third party shouldn't lock every player out.
 */
export async function verifyCaptcha(
  token: string | null | undefined,
  secret: string,
  ip?: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<CaptchaResult> {
  if (!token) return "missing";
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return "unavailable";
    const body = (await res.json()) as { success?: unknown };
    return body.success === true ? "ok" : "rejected";
  } catch {
    return "unavailable";
  }
}
