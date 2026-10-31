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
    /** Connection pool size per server instance (Vercel functions: keep it small). */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
    /** Minimum seconds between opening the sign-up form and submitting it (anti-bot). Tests use 0. */
    SIGN_UP_MIN_SECONDS: z.coerce.number().min(0).max(60).default(3),
    /** Vercel BotID on sign-up, sign-in and password reset. Off until verified on a deployment. */
    NEXT_PUBLIC_BOTID_ENABLED: bool,
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
