import { z } from "zod";

const bool = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const schema = z
  .object({
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
    BETTER_AUTH_URL: z.string().url(),
    REQUIRE_EMAIL_VERIFICATION: bool,
    /** Resend API key; when absent, development prints emails to the console. */
    RESEND_API_KEY: z.string().startsWith("re_").optional(),
    /** Verified sender, e.g. `AWAKEN <system@your-domain.com>`. */
    EMAIL_FROM: z.string().min(3).optional(),
    /** Connection pool size per server instance. */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
    /** Minimum seconds between opening the sign-up form and submitting it (anti-bot). Tests use 0. */
    SIGN_UP_MIN_SECONDS: z.coerce.number().min(0).max(60).default(3),
    /** Most account emails to send per UTC day, site-wide. Resend's free plan allows 100. 0 stops email. */
    EMAIL_DAILY_BUDGET: z.coerce.number().int().min(0).default(90),
    /** Most new accounts per UTC day, site-wide. 0 pauses sign-ups. */
    SIGNUP_DAILY_BUDGET: z.coerce.number().int().min(0).default(500),
    /** Seconds to reuse leaderboard and admin figures before re-querying. Tests use 0. */
    READ_CACHE_SECONDS: z.coerce.number().int().min(0).default(30),
    /** Protects the daily maintenance job. The GitHub Actions workflow sends it; see docs/DEPLOYMENT.md. */
    CRON_SECRET: z.string().min(16).optional(),
    /** Cloudflare Turnstile (captcha). Both keys on, or both off. */
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    /** Web push for the evening reminder (`pnpm push:keys` makes a pair). Both keys on, or both off. */
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    /** "Continue with Google" (docs/DEPLOYMENT.md). Both keys on, or both off. */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .refine((e) => !e.NEXT_PUBLIC_TURNSTILE_SITE_KEY === !e.TURNSTILE_SECRET_KEY, {
    path: ["TURNSTILE_SECRET_KEY"],
    message: "Set both Turnstile keys or neither",
  })
  .refine((e) => !e.GOOGLE_CLIENT_ID === !e.GOOGLE_CLIENT_SECRET, {
    path: ["GOOGLE_CLIENT_SECRET"],
    message: "Set both Google OAuth keys or neither",
  })
  .refine((e) => !e.NEXT_PUBLIC_VAPID_PUBLIC_KEY === !e.VAPID_PRIVATE_KEY, {
    path: ["VAPID_PRIVATE_KEY"],
    message: "Set both VAPID keys or neither",
  })
  .refine((e) => !e.RESEND_API_KEY || !!e.EMAIL_FROM, {
    path: ["EMAIL_FROM"],
    message: "EMAIL_FROM is required when RESEND_API_KEY is set",
  })
  .refine((e) => process.env.NODE_ENV !== "production" || !e.REQUIRE_EMAIL_VERIFICATION || !!e.RESEND_API_KEY, {
    path: ["RESEND_API_KEY"],
    message: "Email verification is required but no email provider is configured",
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with variable names and reasons only — never echo secret values.
  throw new Error(
    `Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")} (${i.message})`).join(", ")}. See .env.example.`,
  );
}

export const env = parsed.data;
