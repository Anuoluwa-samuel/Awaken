import { z } from "zod";
import { AGE_ANSWERS, checkSignUpConsent } from "@/lib/auth/consent-rules";

const email = z.string().trim().toLowerCase().email("Enter a valid email");
const password = z.string().min(10, "At least 10 characters").max(128);

export const loginSchema = z.object({ email, password: z.string().min(1, "Required") });
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(32),
    email,
    password,
    confirm: z.string(),
    ageAnswer: z.enum(AGE_ANSWERS, { message: "Choose your age range" }),
    guardianConsent: z.boolean(),
    acceptTerms: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords do not match" });
    // Same rules and messages as the server (src/lib/auth/consent-rules.ts).
    const consent = checkSignUpConsent(v);
    if (!consent.ok) {
      const path = {
        AGE_REQUIREMENT_NOT_MET: "ageAnswer",
        GUARDIAN_CONSENT_REQUIRED: "guardianConsent",
        TERMS_NOT_ACCEPTED: "acceptTerms",
      }[consent.code];
      ctx.addIssue({ code: "custom", path: [path], message: consent.message });
    }
  });
export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

/** Only allow same-origin relative redirects (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = "/system"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
