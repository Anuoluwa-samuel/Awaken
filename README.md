# AWAKEN

A real-life RPG and productivity system: daily quests, XP, levels, ranks and
attributes for the things you actually do. Original design; not affiliated
with any anime or game.

Design and rules: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
Radix UI · PostgreSQL 17 · Drizzle ORM · Better Auth · Zod · React Hook Form ·
Vitest + PGlite · Playwright

## Local setup

```bash
pnpm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:up                      # Postgres in Docker on localhost:54350
pnpm db:migrate
pnpm db:seed                    # quest templates, skills, achievements (idempotent)
pnpm dev
```

In development, verification and password-reset emails are printed to the
dev-server console. Production has no email provider yet (see
`src/lib/email.ts`) and sending will throw rather than silently fail.

Every full page load opens with the AWAKEN logo intro
(`src/components/brand/intro-splash.tsx`). It stays at least 2.4 s and until the
page has loaded, never more than 6 s; Escape or a click skips it, and it is
shortened for reduced-motion users.

> Don't run `pnpm build` while `pnpm dev` is running — they share `.next`, and the
> dev server can keep serving stale CSS afterwards. If that happens, stop the dev
> server, `rm -rf .next`, and start it again.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` | Route type generation + `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit + integration tests (PGlite), plus concurrency tests against the Docker Postgres when it is running |
| `pnpm test:e2e` | Playwright end-to-end, accessibility (axe) and mobile checks. Needs the Docker Postgres; recreates an `awaken_e2e` database and runs its own server on port 3200 (`.next-e2e`), so it doesn't disturb `pnpm dev` |
| `pnpm db:generate` | Create a migration from schema changes |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Database |
| `pnpm db:check [--repair]` | Verify cached XP/level/rank/attributes against the ledgers |

## Project layout

```
src/
  app/                 routes: (public), (auth), onboarding, system/*, api/auth
  components/          ui/ primitives, shell/, player/, quests/, auth/
  db/                  Drizzle schema, client, seed data
  lib/progression/     pure XP / level / rank / reward / streak rules
  lib/time/            pure quest-day and time-zone logic
  lib/validation/      Zod schemas shared by forms and server actions
  server/services/     business logic; accepts any Drizzle db so it is testable
drizzle/               SQL migrations
tests/unit|integration|e2e
```

## Status

Phases 1–10 are done (everything except deployment). What isn't built or verified yet is listed in
[docs/LIMITATIONS.md](docs/LIMITATIONS.md); the architecture doc ends with the phase checklist.
