import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Throwaway-inbox services commonly used for bulk sign-ups. Deliberately short: the big public
 * lists also block legitimate privacy relays. Subdomains match too (e.g. x.mailinator.com).
 */
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "33mail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamailblock.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "mytemp.email",
  "sharklasers.com",
  "spamgourmet.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.dev",
  "tempmailo.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.net",
]);

export function isDisposableEmail(email: string) {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  const parts = domain.split(".");
  return parts.some((_, i) => DISPOSABLE_DOMAINS.has(parts.slice(i).join(".")));
}

/**
 * A signed "form opened at" timestamp. The register page issues one; sign-up requires it, at least
 * `minSeconds` old (people take longer than that to fill the form; scripts don't) and under a day
 * old. A script posting straight to the API has none.
 */
export function issueFormToken(secret: string, now = Date.now()) {
  const issued = String(Math.floor(now / 1000));
  return `${issued}.${sign(secret, issued)}`;
}

export function checkFormToken(token: unknown, secret: string, minSeconds: number, now = Date.now()) {
  if (typeof token !== "string") return "missing" as const;
  const [issued, signature] = token.split(".");
  if (!issued || !signature || !/^\d+$/.test(issued)) return "invalid" as const;
  const expected = Buffer.from(sign(secret, issued));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid" as const;
  const age = now / 1000 - Number(issued);
  if (age < minSeconds) return "too-fast" as const;
  if (age > 24 * 60 * 60) return "expired" as const;
  return "ok" as const;
}

function sign(secret: string, issued: string) {
  return createHmac("sha256", secret).update(`sign-up-form:${issued}`).digest("base64url");
}

export type SpamBody = { email?: unknown; website?: unknown; formToken?: unknown };

export type SpamDecision =
  | { ok: true }
  | { ok: false; code: "DISPOSABLE_EMAIL"; message: string }
  | { ok: false; code: "SIGN_UP_BLOCKED"; reason: "honeypot" | "missing" | "invalid" | "too-fast" | "expired" };

/** All sign-up spam checks in one place, run by the /sign-up/email before-hook. */
export function checkSignUpSpam(body: SpamBody | undefined, secret: string, minSeconds: number, now = Date.now()) {
  // The honeypot is an off-screen field people never see; anything in it means a form-filling bot.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return { ok: false, code: "SIGN_UP_BLOCKED", reason: "honeypot" } satisfies SpamDecision;
  }
  const token = checkFormToken(body?.formToken, secret, minSeconds, now);
  if (token !== "ok") return { ok: false, code: "SIGN_UP_BLOCKED", reason: token } satisfies SpamDecision;
  if (typeof body?.email === "string" && isDisposableEmail(body.email)) {
    return {
      ok: false,
      code: "DISPOSABLE_EMAIL",
      message: "Use a permanent email address. Temporary inboxes can't be used to sign up.",
    } satisfies SpamDecision;
  }
  return { ok: true } satisfies SpamDecision;
}
