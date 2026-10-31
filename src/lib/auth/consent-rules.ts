import { LEGAL } from "@/lib/legal";

/** Answers to the neutral age question on the sign-up form. None is preselected. */
export const AGE_ANSWERS = ["under13", "teen", "adult"] as const;
export type AgeAnswer = (typeof AGE_ANSWERS)[number];

/**
 * What the sign-up request carries besides name/email/password. Deliberately not named after the
 * user columns: Better Auth rejects request keys that match input:false fields.
 */
export type ConsentBody = { ageAnswer?: unknown; guardianConsent?: unknown; acceptTerms?: unknown };

export type ConsentDecision =
  | { ok: true; ageGroup: "adult" | "teen" }
  | { ok: false; code: "AGE_REQUIREMENT_NOT_MET" | "GUARDIAN_CONSENT_REQUIRED" | "TERMS_NOT_ACCEPTED"; message: string };

/**
 * Server-side rules for creating an account; the form shows the same messages. Under-13s are
 * refused, 13–17s need a parent's or guardian's permission (NDPA 2023 treats under-18s as
 * children), and everyone must accept the Terms and Privacy Policy.
 */
export function checkSignUpConsent(body: ConsentBody | undefined): ConsentDecision {
  const age = body?.ageAnswer;
  if (age !== "teen" && age !== "adult") {
    return {
      ok: false,
      code: "AGE_REQUIREMENT_NOT_MET",
      message: `You need to be ${LEGAL.minimumAge} or older to use AWAKEN.`,
    };
  }
  if (age === "teen" && body?.guardianConsent !== true) {
    return {
      ok: false,
      code: "GUARDIAN_CONSENT_REQUIRED",
      message: "Under 18s need a parent or guardian's permission to use AWAKEN.",
    };
  }
  if (body?.acceptTerms !== true) {
    return { ok: false, code: "TERMS_NOT_ACCEPTED", message: "Accept the Terms and Privacy Policy to continue." };
  }
  return { ok: true, ageGroup: age };
}
