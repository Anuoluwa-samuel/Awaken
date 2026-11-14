import { describe, expect, it } from "vitest";
import { checkProductionEnv } from "@/lib/deploy-check";

const good = {
  // A self-hosted Docker Compose service name: no dot, no TLS needed.
  DATABASE_URL: "postgresql://u:p@awaken-db:5432/awaken",
  MIGRATION_DATABASE_URL: "postgresql://u:p@awaken-db:5432/awaken",
  BETTER_AUTH_SECRET: "k".repeat(44),
  BETTER_AUTH_URL: "https://awaken.example.com",
  NEXT_PUBLIC_APP_URL: "https://awaken.example.com",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "AWAKEN <system@example.com>",
  REQUIRE_EMAIL_VERIFICATION: "true",
};
const levels = (env: Record<string, string | undefined>) => checkProductionEnv(env).map((f) => `${f.level}:${f.key}`);

describe("checkProductionEnv", () => {
  it("passes a complete self-hosted + Resend configuration", () => {
    expect(checkProductionEnv(good).every((f) => f.level === "pass")).toBe(true);
  });

  it("fails on local database, http auth URL, placeholder secret and missing email", () => {
    const out = levels({
      ...good,
      DATABASE_URL: "postgres://awaken:awaken@localhost:54350/awaken",
      BETTER_AUTH_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "replace-me-with-32-random-bytes-xx",
      RESEND_API_KEY: undefined,
      EMAIL_FROM: undefined,
    });
    for (const k of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "RESEND_API_KEY"]) {
      expect(out).toContain(`fail:${k}`);
    }
  });

  it("warns about a pooled migration URL and a public DATABASE_URL without TLS", () => {
    const out = levels({
      ...good,
      DATABASE_URL: "postgresql://u:p@db.example.com/awaken", // a real hostname, no ?sslmode=require
      MIGRATION_DATABASE_URL: "postgresql://u:p@db-pooler.example.com/awaken",
      REQUIRE_EMAIL_VERIFICATION: "false",
    });
    expect(out).toEqual(expect.arrayContaining(["warn:DATABASE_URL", "warn:MIGRATION_DATABASE_URL", "warn:REQUIRE_EMAIL_VERIFICATION"]));
  });

  it("allows launching without email when verification is off", () => {
    const out = checkProductionEnv({ ...good, RESEND_API_KEY: undefined, EMAIL_FROM: undefined, REQUIRE_EMAIL_VERIFICATION: "false" });
    expect(out.some((f) => f.level === "fail")).toBe(false);
    expect(out.find((f) => f.key === "RESEND_API_KEY")).toMatchObject({ level: "warn", message: expect.stringMatching(/password-reset/) });
  });

  it("fails a half-configured email setup", () => {
    expect(levels({ ...good, RESEND_API_KEY: undefined })).toContain("fail:RESEND_API_KEY");
    expect(levels({ ...good, EMAIL_FROM: undefined })).toContain("fail:EMAIL_FROM");
  });

  it("never includes secret values in messages", () => {
    const text = JSON.stringify(checkProductionEnv({ ...good, BETTER_AUTH_SECRET: "short-secret-value" }));
    expect(text).not.toContain("short-secret-value");
    expect(text).not.toContain("u:p@");
  });
});
