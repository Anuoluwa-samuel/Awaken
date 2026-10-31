/** Auth endpoints guarded by Vercel BotID when NEXT_PUBLIC_BOTID_ENABLED=true. */
export const BOTID_PROTECTED = [
  { path: "/api/auth/sign-up/email", method: "POST" },
  { path: "/api/auth/sign-in/email", method: "POST" },
  { path: "/api/auth/request-password-reset", method: "POST" },
] as const;

export const botIdEnabled = process.env.NEXT_PUBLIC_BOTID_ENABLED === "true";
