# Deploying AWAKEN — Vercel + Neon + Resend

About 20 minutes. You need accounts on [Vercel](https://vercel.com), [Neon](https://neon.tech) and
[Resend](https://resend.com), the GitHub repository, and a domain you can add DNS records to (for
sending email). Nothing here needs a credit card on the free tiers.

> Secrets go into the Vercel dashboard (and, for the one-off migration, your shell). Never commit
> them. `pnpm deploy:check` validates your settings without printing them.

## 1. Database — Neon

1. Create a project (Postgres 17, a region close to your Vercel region — e.g. `aws-eu-central-1`
   with Vercel `fra1`). Create a database named `awaken`.
2. On **Connection details**, copy two connection strings:
   - **Pooled** (host contains `-pooler`) → this becomes `DATABASE_URL` for the app.
   - **Direct** (toggle *Connection pooling* off) → this becomes `MIGRATION_DATABASE_URL`.

   Both must end with `?sslmode=require`.

Why two: Vercel functions are short-lived and each opens its own connection, so the app goes
through Neon's PgBouncer pooler (AWAKEN uses 1 connection per function and disables prepared
statements there automatically). Migrations run DDL in transactions and use the direct endpoint.

## 2. Email — Resend

1. **Domains → Add domain** (a subdomain like `mail.your-domain.com` is fine) and add the DNS
   records Resend shows (SPF, DKIM). Wait for *Verified*.
2. **API Keys → Create** with *Sending access* only. Copy it (starts with `re_`) → `RESEND_API_KEY`.
3. Pick the sender → `EMAIL_FROM`, e.g. `AWAKEN <system@mail.your-domain.com>`.

Until the domain is verified, `onboarding@resend.dev` only delivers to your own Resend account
address — fine for a smoke test, not for players.

### No domain yet? Launch without email

Skip this step: leave `RESEND_API_KEY` and `EMAIL_FROM` unset and set
`REQUIRE_EMAIL_VERIFICATION=false`. Everything works except email:

- sign-up doesn't ask players to confirm their address;
- **Forgot password** says resets aren't available on this server instead of pretending to send
  a link (so make sure you remember your own password);
- `pnpm deploy:check` reports a WARN, not a FAIL.

When you have a domain (≈ $10/year from Cloudflare, Namecheap, Porkbun…), do step 2, add the two
variables, set `REQUIRE_EMAIL_VERIFICATION=true`, and redeploy. No code changes are needed.

## 3. Migrate and seed the production database (once, from your machine)

```bash
export DATABASE_URL='<Neon pooled URL>'
export MIGRATION_DATABASE_URL='<Neon direct URL>'
pnpm db:deploy
```

`db:deploy` = `drizzle-kit migrate` (all files in `drizzle/`) + `db:seed` (quest templates, skills,
achievements; idempotent upserts). Re-run it whenever a release adds a migration — **before**
promoting that release. Unset the variables afterwards (`unset DATABASE_URL MIGRATION_DATABASE_URL`)
so local commands don't hit production.

## 4. App — Vercel

1. **Add New → Project → Import** the GitHub repository. Framework preset *Next.js*; root
   directory is the repository root. Build/install commands: the defaults (pnpm is detected from
   `packageManager`). Node.js 22.
2. **Settings → Environment Variables** (Production):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** URL |
   | `MIGRATION_DATABASE_URL` | Neon **direct** URL (only used by `pnpm db:deploy` / `deploy:check --connect`) |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — new, production-only |
   | `BETTER_AUTH_URL` | the public URL, e.g. `https://awaken.your-domain.com` |
   | `NEXT_PUBLIC_APP_URL` | same as `BETTER_AUTH_URL` |
   | `RESEND_API_KEY` | `re_…` (omit until you have a sending domain) |
   | `EMAIL_FROM` | `AWAKEN <system@mail.your-domain.com>` (omit with the key) |
   | `REQUIRE_EMAIL_VERIFICATION` | `true` with email, `false` without |

3. **Deploy.** Then **Settings → Domains** to add your domain, and update `BETTER_AUTH_URL` /
   `NEXT_PUBLIC_APP_URL` if the URL changed (redeploy after changing variables).

### Check the configuration first

Put the same values in an untracked `.env.production.local` (it's git-ignored) and run:

```bash
pnpm deploy:check --env-file .env.production.local --connect
```

It reports PASS / WARN / FAIL per setting (never values), confirms the database is reachable, all
migrations are applied and seed data exists, and exits non-zero if anything would break production.
Delete the file when you're done if you don't want production secrets on disk.

## 5. Verify the deployment

1. `https://<your-domain>/api/health` → `{"status":"ok"}` (503 means the database is unreachable).
2. Register with a real address → the verification email arrives → the link signs you in and opens
   onboarding.
3. Complete a quest → XP and the *First Blood* unlock appear; `/system/progress` shows it.
4. **Forgot password** → the reset email arrives and the new password works.
5. Response headers include `Content-Security-Policy`, `Strict-Transport-Security`,
   `X-Frame-Options: DENY` (e.g. `curl -sI https://<your-domain>/login`).

## How production-specific behaviour is wired

- **Rate limiting** (sign-up 3/min, sign-in 10/min, password-reset 3/5 min, …) is keyed by client IP
  and stored in Postgres (`rate_limit` table) so every function instance shares the counters. On
  Vercel the IP comes from `x-vercel-forwarded-for`, which Vercel sets itself — clients can't spoof
  it. Off Vercel, set `AUTH_IP_HEADER` to the header your proxy **overwrites** (e.g. `x-real-ip`);
  with no usable header, all clients share one bucket.
- **Search & sharing:** canonical URLs, `sitemap.xml`, `robots.txt` and share-card links are
  built from `BETTER_AUTH_URL`; when you add a custom domain, update it and redeploy.
- **Sign-up consent:** sign-up requires an age range and Terms acceptance, stored on the user row
  (migration `0007`).
- **Account lockout:** 5 wrong passwords for one email pause sign-in for 10 min, doubling per
  repeat lock up to 24 h (`auth_lockout` table, migration `0006`). Unlock manually with
  `delete from auth_lockout where email = '<address>'`.
- **Email:** `src/lib/email.ts` uses Resend when `RESEND_API_KEY` is set and refuses to start in
  production with `REQUIRE_EMAIL_VERIFICATION=true` but no key. Provider errors are logged with the
  HTTP status only.
- **Sessions:** secure, HTTP-only cookies in production; 14-day sessions refreshed daily; password
  resets revoke other sessions.
- **Headers:** CSP (same-origin only), HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer,
  camera/mic/geolocation disabled, no `X-Powered-By`. Verified against a local production build.
- **Errors:** route-level and global error pages never show stack traces; production builds strip
  error messages and show a reference digest you can match in Vercel's logs.

## Preview deployments

Vercel preview URLs differ from `BETTER_AUTH_URL`, so sign-in on a preview fails the origin check by
design. To test previews, create a Neon **branch** for them and set Preview-scoped variables
(`DATABASE_URL` from the branch, `BETTER_AUTH_URL` to a fixed preview domain). Never point
previews at the production database.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: lint, typecheck, unit +
integration + real-Postgres concurrency tests, production build, then the Playwright end-to-end,
accessibility and mobile suite. It uses throwaway CI-only values, never production secrets.
Enable **branch protection** on `main` requiring the *CI* checks before merging.

## Releasing

1. Merge to `main` (CI green).
2. If the release adds files in `drizzle/`, run `pnpm db:deploy` against production (step 3).
3. Vercel deploys `main` automatically. Check `/api/health`.

Rollback: **Vercel → Deployments → Promote** a previous deployment. Migrations are additive; if a
release's migration must be undone, write a new migration rather than editing applied ones.

## Operations

- **Consistency check:** `pnpm db:check` (with the production URLs exported) verifies cached XP,
  levels, ranks and attributes against the ledgers; `--repair` rebuilds caches from the ledgers
  and writes an audit event.
- **Backups:** Neon keeps point-in-time history (the window depends on your plan). Restore by
  branching from a timestamp.
- **Logs:** Vercel → Project → Logs. Health-check failures and email-provider errors are logged
  without secrets.
