import { describe, expect, it } from "vitest";
import { checkSignUpConsent } from "@/lib/auth/consent-rules";
import { registerSchema } from "@/lib/validation/auth";

describe("checkSignUpConsent", () => {
  it("accepts adults who accept the terms", () => {
    expect(checkSignUpConsent({ ageAnswer: "adult", acceptTerms: true })).toEqual({ ok: true, ageGroup: "adult" });
  });

  it("accepts 13–17s only with a parent or guardian's permission", () => {
    expect(checkSignUpConsent({ ageAnswer: "teen", acceptTerms: true })).toMatchObject({
      ok: false,
      code: "GUARDIAN_CONSENT_REQUIRED",
    });
    expect(checkSignUpConsent({ ageAnswer: "teen", guardianConsent: true, acceptTerms: true })).toEqual({
      ok: true,
      ageGroup: "teen",
    });
  });

  it("refuses under-13s, missing or unknown answers", () => {
    for (const ageAnswer of ["under13", undefined, "", "ADULT", 18, true]) {
      expect(checkSignUpConsent({ ageAnswer, guardianConsent: true, acceptTerms: true })).toMatchObject({
        ok: false,
        code: "AGE_REQUIREMENT_NOT_MET",
      });
    }
    expect(checkSignUpConsent(undefined)).toMatchObject({ ok: false, code: "AGE_REQUIREMENT_NOT_MET" });
  });

  it("requires the terms to be accepted with a real boolean", () => {
    for (const acceptTerms of [false, undefined, "true", 1]) {
      expect(checkSignUpConsent({ ageAnswer: "adult", acceptTerms })).toMatchObject({
        ok: false,
        code: "TERMS_NOT_ACCEPTED",
      });
    }
  });
});

describe("registerSchema", () => {
  const base = { name: "Jin", email: "jin@awaken.test", password: "0123456789", confirm: "0123456789" };
  const issues = (v: object) =>
    registerSchema.safeParse({ guardianConsent: false, acceptTerms: false, ...base, ...v }).error?.issues.map((i) => [
      i.path.join("."),
      i.message,
    ]);

  it("shows the server's messages on the matching fields", () => {
    expect(issues({ ageAnswer: "under13", acceptTerms: true })).toEqual([
      ["ageAnswer", "You need to be 13 or older to use AWAKEN."],
    ]);
    expect(issues({ ageAnswer: "teen", acceptTerms: true })).toEqual([
      ["guardianConsent", "Under 18s need a parent or guardian's permission to use AWAKEN."],
    ]);
    expect(issues({ ageAnswer: "adult" })).toEqual([["acceptTerms", "Accept the Terms and Privacy Policy to continue."]]);
    expect(issues({})).toEqual([["ageAnswer", "Choose your age range"]]);
    expect(issues({ ageAnswer: "adult", acceptTerms: true })).toBeUndefined();
  });
});
