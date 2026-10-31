# Known limitations

What AWAKEN does **not** do yet, or does with caveats. Each item says what would fix it.
Items marked **Phase 11** must be resolved before a public deployment.

## Verification & honesty

- **Completions are self-reported.** Quests, habits and milestones are checked off by the player;
  the UI labels them "self-reported". Nothing verifies a workout or study session.
- **Focus measures time, not attention.** The server validates that a session's planned time has
  elapsed (excluding pauses); it can't tell whether the player was focusing.

## Deployment (resolved in Phase 11, needs your accounts)

Production is prepared for **Vercel + Neon + Resend** — see [DEPLOYMENT.md](DEPLOYMENT.md). What
remains is on your side: creating the accounts, verifying a sending domain, and entering the
secrets. Specifically:

- **Email** is sent through Resend when `RESEND_API_KEY` + `EMAIL_FROM` are set. Without them,
  production refuses to start if email verification is required, and password reset is unavailable.
- **Rate limiting** keys on Vercel's `x-vercel-forwarded-for` (not spoofable) and stores counters
  in Postgres, shared across instances. Off Vercel, `AUTH_IP_HEADER` must name a header your proxy
  overwrites; with none, all clients share one bucket.
- **Preview deployments** need their own Neon branch and `BETTER_AUTH_URL`; sign-in on an arbitrary
  preview URL fails the origin check by design.
- **Not done here:** the actual account creation and first deploy, custom-domain DNS, and an
  uptime monitor on `/api/health`.

## Behaviour by design (documented, may surprise)

- **Quests are generated lazily** when the player opens the app (no background job). Days the player
  never opens AWAKEN generate no quests, so they don't count as missed in analytics. Deadline
  reminders are also created on visit, not pushed.
- **"Not found" under `/system` returns HTTP 200** with a `noindex` tag. Pages there stream behind a
  loading boundary, so the status is sent before `notFound()` runs. Content is identical for "not
  yours" and "doesn't exist" (asserted in E2E). Fix if a real 404 matters: remove
  `src/app/system/loading.tsx` or move the ownership check above the boundary.
- **Time zone / day-start changes** are limited to once every 7 days (prevents farming extra daily
  sets). Changing focus areas later doesn't reschedule existing starter quests; it affects weekly
  challenges.
- **Rewards are fixed at creation.** Quests can't be edited (only cancelled), so a reward can never
  change silently.

## Missing features

- **No undo** for quest completions, habit check-ins or milestones (undoing would need a negative
  XP adjustment and a level-down rule; deliberately left out).
- **Recurring custom quests can't be paused or deleted** from the UI yet (each day's instance can
  be skipped). Goals and milestones can't be renamed, reordered or removed — goals can be archived.
- **Notifications are in-app only.** No email, push or browser notifications, and AWAKEN never asks
  for browser notification permission. Habit reminder times are stored in the schema but not
  offered in the UI, since nothing would deliver them.
- **No avatar upload** (optional in the brief); avatars are initials.
- **No admin area.** Quest templates, skills and achievements come from `src/db/seed-data.ts`
  (`pnpm db:seed` upserts them).
- **Titles** come only from achievements.

## Quality coverage

| Area | Coverage |
|---|---|
| Unit | XP curve, ranks, rewards/caps, time zones & DST, quest states, streaks, habits, achievements, skills, focus timing, goals, analytics helpers, key components (RTL) |
| Integration (PGlite) | every service: rewards, quests, custom quests, weekly, habits, achievements, skills, focus, goals, analytics, notifications, consistency/repair, isolation |
| Concurrency (real Postgres) | duplicate grants, daily caps, custom limits, quest/habit/focus/goal/milestone races, skill unlocks, achievement evaluation, daily generation — needs Docker running, otherwise skipped |
| End-to-end (Playwright, Chromium) | full first session, XP exactly once on double click, level-up at threshold, achievement, focus recovery after reload, progress figures vs. the ledger, sign-in redirects, open-redirect guard, sign-out, cross-player isolation, per-client sign-up rate limit |
| Accessibility | axe (WCAG 2.1 A/AA) on 18 pages with zero serious/critical issues; skip link and visible focus; reduced motion honoured |
| Responsive | no horizontal overflow on 18 pages at Pixel 7 size; every section reachable from the mobile menu |

Not covered: browsers other than Chromium, manual screen-reader testing (VoiceOver/NVDA), load
testing, and a live deployment (the production build was verified locally: CSP, headers, health,
DB-backed rate limits).
