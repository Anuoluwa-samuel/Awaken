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

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm typecheck` | Route type generation + `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit + integration tests (PGlite), plus concurrency tests against the Docker Postgres when it is running |
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

Phases 1–4 (design, foundation, progression engine, quest engine) are done. See the checklist at the
end of the architecture doc for what comes next.
