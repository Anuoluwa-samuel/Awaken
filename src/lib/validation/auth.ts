import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Enter a valid email");
const password = z.string().min(10, "At least 10 characters").max(128);

export const loginSchema = z.object({ email, password: z.string().min(1, "Required") });
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(32),
    email,
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

/** Only allow same-origin relative redirects (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = "/system"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
