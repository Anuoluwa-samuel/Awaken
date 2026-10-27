import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),
  REQUIRE_EMAIL_VERIFICATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with the variable names only — never echo secret values.
  throw new Error(
    `Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}. See .env.example.`,
  );
}

export const env = parsed.data;
