# Deploying AWAKEN — Oracle Cloud + Docker + Caddy + Resend

Self-hosted: the app and its own Postgres run as Docker containers on a VM you already have
(Oracle Cloud's Always Free tier, sharing the box with other projects), behind an existing shared
Caddy reverse proxy. You need the VM, a domain (you have `getawaken.com.ng`), and a
[Resend](https://resend.com) account for email. Nothing here needs a credit card beyond what the
VM and domain already cost.

> Secrets go into `.env.production` on the VM (`chmod 600`, never committed — see
> `.env.production.example`). `pnpm deploy:check` validates your settings without printing them.

## 1. The VM

Assumes: Docker is already installed, and a Caddy container is already reverse-proxying your other
projects on a shared Docker network. If that's not the case yet, set those up first — this doc
starts from there.

1. Confirm Docker works and find Caddy's network name:
   ```bash
   docker network ls
   ```
   Put that name in `.env.production` as `CADDY_NETWORK` (step 4).
2. Point `getawaken.com.ng`'s DNS A record at the VM's public IP, and open ports 80/443 in the
   VM's security list (Oracle Cloud's firewall is in the Console, **not** just `iptables` on the
   box — both need the rule).
3. Clone the repository onto the VM (or pull it if it's already there from CI — see CI below).

## 2. Database — Postgres in its own container

`docker-compose.prod.yml` defines `awaken-db` (Postgres 17, its own named volume, isolated on an
`internal` Docker network — nothing but `awaken-app` can reach it). No separate account or
provisioning step: it's created the first time you bring the stack up (step 5).

### Migrating existing data from Neon

Skip this if you're starting fresh. Otherwise, dump Neon from your own machine, copy the dump to
the VM, and restore it there — `awaken-db` is never reachable from the internet (see
`docker-compose.prod.yml`'s loopback-only `ports:`), so the restore has to run on the VM itself.
Never paste either database's URL into chat with an assistant, or into anything but your own shell.

From your machine:

```bash
export NEON_URL='<your Neon direct connection string>'
pg_dump "$NEON_URL" --format=custom --no-owner --no-privileges --file=awaken-migrate.dump
scp awaken-migrate.dump your-vm:/tmp/
rm -f awaken-migrate.dump
```

On the VM (after step 5 has brought `awaken-db` up at least once, and with `pg_restore` installed —
see docs/BACKUPS.md step 2):

```bash
PGPASSWORD=<POSTGRES_PASSWORD> pg_restore --dbname="postgres://awaken:<POSTGRES_PASSWORD>@localhost:5432/awaken" \
  --no-owner --no-privileges --single-transaction --exit-on-error /tmp/awaken-migrate.dump
psql -h localhost -U awaken -d awaken -c 'select count(*) from "user"'
rm -f /tmp/awaken-migrate.dump
```

Confirm the row count looks right before decommissioning the Neon project.

## 3. Email — Resend

Unaffected by the move. If you already set this up for the Vercel deployment, it carries over
unchanged — nothing here is Vercel-specific.

1. **Domains → Add domain** (a subdomain like `mail.getawaken.com.ng` is fine) and add the DNS
   records Resend shows (SPF, DKIM). Wait for *Verified*.
2. **API Keys → Create** with *Sending access* only. Copy it (starts with `re_`) → `RESEND_API_KEY`.
3. Pick the sender → `EMAIL_FROM`, e.g. `AWAKEN <system@mail.getawaken.com.ng>`.

Until the domain is verified, `onboarding@resend.dev` only delivers to your own Resend account
address — fine for a smoke test, not for players.

### No domain yet? Launch without email

(Not your case now that you have `getawaken.com.ng` — kept here in case a future environment
doesn't.) Leave `RESEND_API_KEY` and `EMAIL_FROM` unset and set `REQUIRE_EMAIL_VERIFICATION=false`.
Everything works except email; `pnpm deploy:check` reports a WARN, not a FAIL.

## 4. Configure `.env.production`

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Fill in every value `.env.production.example` lists — `POSTGRES_PASSWORD`, `CADDY_NETWORK`,
`BETTER_AUTH_SECRET` (`openssl rand -base64 32`, new and production-only), `CRON_SECRET` (the same
value you already put in the GitHub repo's `CRON_SECRET` secret, or generate one now and update
both), and the Resend/VAPID/Turnstile pairs if you're using them.

### Check the configuration first

```bash
pnpm deploy:check --env-file .env.production --connect
```

It reports PASS / WARN / FAIL per setting (never values), confirms the database is reachable, all
migrations are applied and seed data exists, and exits non-zero if anything would break
production.

## 5. Build and run

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

First run: migrate and seed, using the `awaken-tools` service (the only one with
devDependencies and the repo source — `awaken-app`'s own image is a stripped standalone build).
`db:deploy` already requires `CONFIRM_PRODUCTION_DB=yes` for a remote-looking URL and sets it
itself (see `src/db/safety.ts`), so nothing extra is needed here:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm awaken-tools pnpm db:deploy
```

Re-run whenever a release adds a file in `drizzle/` — **before** restarting the app on that
release, and check last night's backup succeeded first (docs/BACKUPS.md).

### Caddy

Add `ops/Caddyfile.awaken`'s block to your existing shared Caddyfile (or `import` it as a separate
file), then reload Caddy:

```bash
docker exec <your-caddy-container-name> caddy reload --config /etc/caddy/Caddyfile
```

## 6. Verify the deployment

1. `https://getawaken.com.ng/api/health` → `{"status":"ok"}` (503 means the database is
   unreachable).
2. Register with a real address → the verification email arrives → the link signs you in and opens
   onboarding.
3. Complete a quest → XP and the *First Blood* unlock appear; `/system/progress` shows it.
4. **Forgot password** → the reset email arrives and the new password works.
5. Response headers include `Content-Security-Policy`, `Strict-Transport-Security`,
   `X-Frame-Options: DENY` (e.g. `curl -sI https://getawaken.com.ng/login`).

## How production-specific behaviour is wired

- **Rate limiting** (sign-up 5/hour, sign-in 10/min, password-reset 3/5 min, …) is keyed by client
  IP and stored in Postgres (`rate_limit` table) so every instance shares the counters. The IP
  comes from `AUTH_IP_HEADER` (default `x-forwarded-for`) — `ops/Caddyfile.awaken` explicitly
  replaces that header rather than trusting whatever a client sent, so it can't be spoofed by
  connecting straight to the app (it isn't reachable except through Caddy anyway, since it's only
  `expose`d, not `ports`-published).
- **Search & sharing:** canonical URLs, `sitemap.xml`, `robots.txt` and share-card links are
  built from `BETTER_AUTH_URL`; if the domain ever changes, update it and redeploy.
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
  camera/mic/geolocation disabled, no `X-Powered-By`.
- **Errors:** route-level and global error pages never show stack traces; production builds strip
  error messages and show a reference digest you can match in the container's logs
  (`docker compose -f docker-compose.prod.yml logs awaken-app`).

## Admin access

The dashboard is at `/admin`. Sign up normally, then grant your account access from the VM, with
`DATABASE_URL` already pointed at `awaken-db` in `.env.production`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm \
  -e CONFIRM_PRODUCTION_DB=yes awaken-tools pnpm admin:grant you@example.com
```

Add `--revoke` to remove access. It takes effect on the next page load. Everyone else gets the
normal "not found" page.

## Backups

Set these up before you have real players: see [BACKUPS.md](BACKUPS.md). Self-hosted Postgres has
no provider-managed point-in-time restore — the nightly encrypted dump is the only safety net.

## Limits, captcha and cost controls

Rate limits, quotas, throttling and budgets work with no setup.

**The daily clean-up job** runs via `.github/workflows/maintenance.yml` (GitHub Actions, not a
platform cron feature) hitting `/api/cron/maintenance` with `CRON_SECRET` — add `SITE_URL` and
`CRON_SECRET` as repository secrets (`gh secret set SITE_URL`, `gh secret set CRON_SECRET`) with
the **same** `CRON_SECRET` value as `.env.production`. Without it, the job answers 404 and does
nothing; GitHub Actions's free tier easily covers an hourly + a daily ping.

**Turn on captcha** (recommended once you have real traffic):

1. In [Cloudflare](https://dash.cloudflare.com) → **Turnstile** → **Add widget** (free). Add
   `getawaken.com.ng` and choose **Managed**.
2. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to `.env.production`, rebuild
   (`docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build awaken-app`
   — the site key is read at build time). Add Cloudflare to the CSP in `next.config.ts` if it isn't
   already (the file already does this automatically when the key is set).
3. Create a test account to confirm it. To turn captcha off, remove both and rebuild.

**Adjust the budgets** if you need to: `EMAIL_DAILY_BUDGET` (default 90; Resend's free plan allows
100 a day) and `SIGNUP_DAILY_BUDGET` (default 500). Setting either to `0` is an emergency stop.

**Also set spending limits where the bills are**, since the app can't do this for you: Oracle
Cloud's Always Free tier doesn't bill unless you explicitly upgrade past it (check **Billing →
Cost Analysis** periodically anyway), and Resend's plan limits.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: lint, typecheck, unit +
integration + real-Postgres concurrency tests, production build, then the Playwright end-to-end,
accessibility and mobile suite. It uses throwaway CI-only values, never production secrets.
Enable **branch protection** on `main` requiring the *CI* checks before merging.

There's no CD workflow here deploying to the VM automatically — releasing (below) is a manual
step you run yourself, matching the rest of this setup.

## Releasing

1. Merge to `main` (CI green).
2. On the VM: `git pull`, then `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.
3. If the release adds files in `drizzle/`, run the migrate step from "Build and run" above
   **before** step 2 — check last night's backup succeeded first.
4. Check `/api/health`.

Rollback: `git checkout <previous commit>` on the VM, then repeat step 2. Migrations are additive;
if a release's migration must be undone, write a new migration rather than editing applied ones.

## Operations

- **Consistency check:** from the VM,
  `docker compose -f docker-compose.prod.yml --env-file .env.production run --rm awaken-tools pnpm db:check`
  verifies cached XP, levels, ranks and attributes against the ledgers. Add `-- --repair` (and
  `-e CONFIRM_PRODUCTION_DB=yes`) to rebuild caches from the ledgers and write an audit event.
- **Backups:** docs/BACKUPS.md — nightly encrypted dumps, pruned after `KEEP_DAYS`.
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f awaken-app` (or `awaken-db`).
  Health-check failures and email-provider errors are logged without secrets.
