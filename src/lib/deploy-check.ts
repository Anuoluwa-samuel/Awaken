// Production configuration checks (pure). Used by `pnpm deploy:check`; never returns values.

export type Finding = { level: "pass" | "warn" | "fail"; key: string; message: string };

function url(value: string | undefined) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}
const isLocal = (host: string) => ["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".local");

export function checkProductionEnv(env: Record<string, string | undefined>): Finding[] {
  const out: Finding[] = [];
  const add = (level: Finding["level"], key: string, message: string) => out.push({ level, key, message });

  const db = url(env.DATABASE_URL);
  if (!db || !/^postgres(ql)?:$/.test(db.protocol)) add("fail", "DATABASE_URL", "missing or not a postgres:// URL");
  else if (isLocal(db.hostname)) add("fail", "DATABASE_URL", "points at a local database");
  else {
    add("pass", "DATABASE_URL", "remote Postgres URL");
    if (db.searchParams.get("sslmode") !== "require") add("warn", "DATABASE_URL", "add ?sslmode=require (Neon requires TLS)");
    if (db.hostname.includes(".neon.tech") && !db.hostname.includes("-pooler")) {
      add("warn", "DATABASE_URL", "use Neon's pooled connection string (host contains -pooler) for the app");
    }
  }

  const mig = url(env.MIGRATION_DATABASE_URL);
  if (!mig) add("warn", "MIGRATION_DATABASE_URL", "not set — migrations will use DATABASE_URL; prefer Neon's direct (unpooled) URL");
  else if (mig.hostname.includes("-pooler")) add("warn", "MIGRATION_DATABASE_URL", "should be the direct (unpooled) URL, not -pooler");
  else add("pass", "MIGRATION_DATABASE_URL", "direct connection for migrations");

  const secret = env.BETTER_AUTH_SECRET ?? "";
  if (secret.length < 32) add("fail", "BETTER_AUTH_SECRET", "missing or shorter than 32 characters");
  else if (/replace-me|e2e-secret|changeme/i.test(secret)) add("fail", "BETTER_AUTH_SECRET", "still a placeholder");
  else add("pass", "BETTER_AUTH_SECRET", "set");

  const auth = url(env.BETTER_AUTH_URL);
  if (!auth) add("fail", "BETTER_AUTH_URL", "missing or invalid");
  else if (auth.protocol !== "https:" || isLocal(auth.hostname)) add("fail", "BETTER_AUTH_URL", "must be the public https:// URL");
  else add("pass", "BETTER_AUTH_URL", "public https URL");

  const app = url(env.NEXT_PUBLIC_APP_URL);
  if (auth && app && app.origin !== auth.origin) add("warn", "NEXT_PUBLIC_APP_URL", "differs from BETTER_AUTH_URL");

  const verificationOn = env.REQUIRE_EMAIL_VERIFICATION === "true";
  if (!env.RESEND_API_KEY && !env.EMAIL_FROM) {
    // Launching without a sending domain is allowed, as long as nothing depends on email.
    if (verificationOn) add("fail", "RESEND_API_KEY", "missing, but REQUIRE_EMAIL_VERIFICATION=true needs email");
    else add("warn", "RESEND_API_KEY", "not set — no verification or password-reset emails until it is");
  } else {
    if (!env.RESEND_API_KEY) add("fail", "RESEND_API_KEY", "missing while EMAIL_FROM is set");
    else if (!env.RESEND_API_KEY.startsWith("re_")) add("fail", "RESEND_API_KEY", "doesn't look like a Resend key (re_…)");
    else add("pass", "RESEND_API_KEY", "set");

    const from = env.EMAIL_FROM ?? "";
    if (!/@[^\s>]+\.[^\s>]+/.test(from)) add("fail", "EMAIL_FROM", "missing — e.g. AWAKEN <system@your-domain.com> on a verified domain");
    else if (/@resend\.dev\b/i.test(from)) add("warn", "EMAIL_FROM", "resend.dev can only send to your own address; verify a domain");
    else add("pass", "EMAIL_FROM", "set");
  }

  if (!verificationOn) {
    add("warn", "REQUIRE_EMAIL_VERIFICATION", "off — accounts can sign in without confirming their email");
  } else add("pass", "REQUIRE_EMAIL_VERIFICATION", "on");

  return out;
}
