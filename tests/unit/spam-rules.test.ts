import { describe, expect, it } from "vitest";
import { checkFormToken, checkSignUpSpam, isDisposableEmail, issueFormToken } from "@/lib/auth/spam-rules";

const SECRET = "unit-test-secret-unit-test-secret-0001";
const T0 = Date.parse("2026-10-31T10:00:00Z");
const sec = (n: number) => T0 + n * 1000;

describe("isDisposableEmail", () => {
  it("matches listed domains and their subdomains, case-insensitively", () => {
    expect(isDisposableEmail("bot@mailinator.com")).toBe(true);
    expect(isDisposableEmail("bot@inbox.MAILINATOR.com")).toBe(true);
    expect(isDisposableEmail("bot@yopmail.net")).toBe(true);
  });
  it("leaves ordinary and look-alike domains alone", () => {
    for (const email of ["jin@gmail.com", "jin@notmailinator.com", "jin@mailinator.com.ng", "no-at-sign"]) {
      expect(isDisposableEmail(email)).toBe(false);
    }
  });
});

describe("form token", () => {
  const token = issueFormToken(SECRET, T0);

  it("is accepted between the minimum fill time and 24 hours", () => {
    expect(checkFormToken(token, SECRET, 3, sec(3))).toBe("ok");
    expect(checkFormToken(token, SECRET, 3, sec(23 * 3600))).toBe("ok");
  });
  it("rejects forms submitted too fast or too late", () => {
    expect(checkFormToken(token, SECRET, 3, sec(1))).toBe("too-fast");
    expect(checkFormToken(token, SECRET, 3, sec(25 * 3600))).toBe("expired");
  });
  it("rejects missing, malformed, tampered or foreign tokens", () => {
    expect(checkFormToken(undefined, SECRET, 0, sec(5))).toBe("missing");
    expect(checkFormToken("", SECRET, 0, sec(5))).toBe("invalid");
    expect(checkFormToken("abc.def", SECRET, 0, sec(5))).toBe("invalid");
    // Backdating the timestamp breaks the signature.
    const [, signature] = token.split(".");
    expect(checkFormToken(`${T0 / 1000 - 60}.${signature}`, SECRET, 0, sec(5))).toBe("invalid");
    expect(checkFormToken(issueFormToken("another-secret-another-secret-0002", T0), SECRET, 0, sec(5))).toBe("invalid");
  });
});

describe("checkSignUpSpam", () => {
  const formToken = issueFormToken(SECRET, T0);
  const ok = { email: "jin@gmail.com", website: "", formToken };

  it("passes a normal sign-up", () => {
    expect(checkSignUpSpam(ok, SECRET, 3, sec(10))).toEqual({ ok: true });
  });
  it("blocks a filled honeypot first", () => {
    expect(checkSignUpSpam({ ...ok, website: "https://spam.example" }, SECRET, 3, sec(10))).toMatchObject({
      ok: false,
      reason: "honeypot",
    });
  });
  it("blocks requests without a valid, aged form token", () => {
    expect(checkSignUpSpam({ email: ok.email }, SECRET, 3, sec(10))).toMatchObject({ reason: "missing" });
    expect(checkSignUpSpam(ok, SECRET, 3, sec(1))).toMatchObject({ reason: "too-fast" });
  });
  it("explains a disposable address, since a real person can fix that", () => {
    expect(checkSignUpSpam({ ...ok, email: "x@guerrillamail.com" }, SECRET, 3, sec(10))).toMatchObject({
      ok: false,
      code: "DISPOSABLE_EMAIL",
    });
  });
});
