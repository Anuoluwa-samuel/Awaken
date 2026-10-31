import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { emailTransportAvailable, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { checkSignUpConsent, type ConsentBody } from "@/lib/auth/consent-rules";
import { describeWait, normaliseEmail } from "@/lib/auth/lockout-rules";
import { checkSignUpSpam, type SpamBody } from "@/lib/auth/spam-rules";
import { LEGAL } from "@/lib/legal";
import { purgeAccountExtras } from "@/server/services/account";
import { clearLockout, recordFailure, reserveAttempt } from "@/server/services/lockout";

const SIGN_IN = "/sign-in/email";
const SIGN_UP = "/sign-up/email";
const DELETE_USER = "/delete-user";

function lockedError(retryAfterSeconds: number) {
  return new APIError(
    "FORBIDDEN",
    {
      code: "ACCOUNT_LOCKED",
      message: `Too many wrong passwords. Sign-in is paused for ${describeWait(retryAfterSeconds)}.`,
      retryAfterSeconds,
    },
    { "Retry-After": String(retryAfterSeconds) },
  );
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    revokeSessionsOnPasswordReset: true,
    // A successful reset proves control of the email, so it lifts any sign-in lockout.
    onPasswordReset: async ({ user }) => {
      const email = normaliseEmail(user.email);
      if (email) await clearLockout(db, email);
    },
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "AWAKEN — reset your password",
        text: `A password reset was requested for your account.\n\nReset it here (valid 30 minutes):\n${url}\n\nIf this wasn't you, ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: emailTransportAvailable,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "AWAKEN — verify your email",
        text: `Confirm your email to secure your account:\n${url}`,
      });
    },
  },
  user: {
    // Written only by the create hook below, never from request input. The form sends its
    // answers as ageAnswer/guardianConsent/acceptTerms, which Better Auth ignores as unknown keys.
    additionalFields: {
      ageGroup: { type: "string", required: false, input: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
      termsVersion: { type: "string", required: false, input: false },
    },
    // Self-serve deletion from Settings. The before-hook below makes the password mandatory.
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await purgeAccountExtras(db, user.id, user.email);
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Stamp the consent the before-hook already validated onto the new user row.
        before: async (user, ctx) => {
          const consent = checkSignUpConsent(ctx?.body as ConsentBody | undefined);
          if (!consent.ok) throw new APIError("BAD_REQUEST", { code: consent.code, message: consent.message });
          return {
            data: { ...user, ageGroup: consent.ageGroup, termsAcceptedAt: new Date(), termsVersion: LEGAL.updated },
          };
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    // Counters live in Postgres so every server instance (and every short-lived Vercel
    // function) shares them; in-memory counters would reset per instance.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      // Per-IP; per-account guessing is handled by the lockout (5 wrong → locked).
      "/sign-in/email": { window: 60, max: 10 },
      // 5 per hour per IP: plenty for a household or classroom, too few for a sign-up farm.
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
      "/send-verification-email": { window: 300, max: 3 },
      [DELETE_USER]: { window: 600, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    // Client IP for rate limiting — see docs/DEPLOYMENT.md. On Vercel the platform sets
    // x-vercel-forwarded-for itself (clients can't spoof it). Elsewhere, AUTH_IP_HEADER names the
    // header your proxy overwrites; locally Better Auth falls back to 127.0.0.1.
    ipAddress: {
      ipAddressHeaders: process.env.VERCEL
        ? ["x-vercel-forwarded-for"]
        : [process.env.AUTH_IP_HEADER || "x-forwarded-for"],
    },
    database: { generateId: () => crypto.randomUUID() },
  },
  // Per-account lockout (src/server/services/lockout.ts, docs/ARCHITECTURE.md §6g).
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === DELETE_USER) {
        // Better Auth would otherwise accept a recent session alone, or an emailed token.
        const body = ctx.body as { password?: unknown; token?: unknown } | undefined;
        if (typeof body?.password !== "string" || body.password.length === 0 || body.token !== undefined) {
          throw new APIError("BAD_REQUEST", { code: "PASSWORD_REQUIRED", message: "Enter your password to delete your account." });
        }
        return;
      }
      if (ctx.path === "/delete-user/callback") throw new APIError("NOT_FOUND");
      if (ctx.path === SIGN_UP) {
        const spam = checkSignUpSpam(ctx.body as SpamBody | undefined, env.BETTER_AUTH_SECRET, env.SIGN_UP_MIN_SECONDS);
        if (!spam.ok) {
          if (spam.code === "DISPOSABLE_EMAIL") throw new APIError("BAD_REQUEST", { code: spam.code, message: spam.message });
          // Deliberately vague: telling a bot which check it failed helps it adapt.
          console.warn(`[sign-up] blocked: ${spam.reason}`);
          throw new APIError("BAD_REQUEST", { code: spam.code, message: "We couldn't create that account." });
        }
        const consent = checkSignUpConsent(ctx.body as ConsentBody | undefined);
        if (!consent.ok) throw new APIError("BAD_REQUEST", { code: consent.code, message: consent.message });
        return;
      }
      if (ctx.path !== SIGN_IN) return;
      const email = normaliseEmail((ctx.body as { email?: unknown } | undefined)?.email);
      if (!email) return;
      const decision = await reserveAttempt(db, email);
      if (!decision.allowed) throw lockedError(decision.retryAfterSeconds);
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN) return;
      const email = normaliseEmail((ctx.body as { email?: unknown } | undefined)?.email);
      if (!email) return;
      const result = ctx.context.returned;
      if (isAPIError(result)) {
        if (result.statusCode !== 401) return; // only wrong credentials count as failures
        const locked = await recordFailure(db, email);
        if (locked && !locked.allowed) throw lockedError(locked.retryAfterSeconds);
        return;
      }
      await clearLockout(db, email);
    }),
  },
  // Must be last: lets server actions set auth cookies.
  plugins: [nextCookies()],
});
