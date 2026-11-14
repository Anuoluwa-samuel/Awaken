# Known limitations

What AWAKEN does **not** do yet, or does with caveats. Each item says what would fix it.
Items marked **Phase 11** must be resolved before a public deployment.

## Verification & honesty

- **Completions are self-reported.** Quests, habits and milestones are checked off by the player;
  the UI labels them "self-reported". Nothing verifies a workout or study session.
- **Focus measures time, not attention.** The server validates that a session's planned time has
  elapsed (excluding pauses); it can't tell whether the player was focusing.

## Deployment (resolved in Phase 11, needs your accounts)

Production is prepared for **self-hosted Docker + Caddy + Resend** on your own VM — see
[DEPLOYMENT.md](DEPLOYMENT.md). What remains is on your side: the VM, verifying a sending domain,
and entering the secrets. Specifically:

- **Email** is sent through Resend when `RESEND_API_KEY` + `EMAIL_FROM` are set. Without them
  (e.g. no sending domain yet), production runs with verification off and the password-reset page
  says resets aren't available; it refuses to start if verification is required.
- **Rate limiting** keys on `AUTH_IP_HEADER` (default `x-forwarded-for`), which only resists
  spoofing if the reverse proxy in front of the app explicitly overwrites it rather than appending
  (`ops/Caddyfile.awaken` does this) and the app isn't directly reachable another way (it isn't —
  see `docker-compose.prod.yml`'s `expose`, not `ports`). With no proxy doing this, all clients
  would share one bucket.
- **Backups rely on the VM:** there's no provider-managed point-in-time restore for a self-hosted
  Postgres container, so [BACKUPS.md](BACKUPS.md)'s nightly encrypted dump is the only net.
- **Not done here:** the actual VM provisioning, custom-domain DNS, and an uptime monitor on
  `/api/health`.

## Account lockout

- Five wrong passwords lock sign-in for an email for 10 minutes, doubling per consecutive lock (max
  24 h). Anyone who knows a player's email can deliberately keep them locked out (the classic
  trade-off of account lockout); password reset unlocks immediately once email is configured.
  An admin unlock tool doesn't exist yet — clear the `auth_lockout` row to unlock manually.
- `auth_lockout` keeps a row per attempted email; `pruneLockouts()` exists for housekeeping but no
  scheduled job runs it yet.

## Backups

- **Nothing is backed up until you finish [BACKUPS.md](BACKUPS.md)** (a passphrase and a systemd
  timer on the VM). The script has been tested, but not yet against a real production restore.
- **The most recent backup can be up to a day behind.** There's no point-in-time restore in
  between — a self-hosted Postgres container doesn't have Neon's instant-restore equivalent.

## Limits and costs

- **The request throttle is per server instance,** so with more than one `awaken-app` container
  running it's approximate (there's only one in the default setup). It's a cheap first filter; the
  exact limits behind it are shared in Postgres.
- **Limits can't be set per player or changed without a redeploy.** There's no admin screen for them,
  and no paid tier with higher ones.
- **The app can't see your actual bills.** The dashboard shows emails, sign-ups and database size, not
  what the VM or Resend charge. Oracle's Always Free tier doesn't bill unless you exceed it; check
  anyway (DEPLOYMENT.md).
- **Throttling relies on `AUTH_IP_HEADER`** naming a header your reverse proxy overwrites, not
  appends to — see the deployment note above.
- **If Cloudflare is down,** captcha is skipped for that request, and logged. Rate limits and lockout
  still apply.

## Leaderboard fairness

- **XP is self-reported and there's no daily XP limit,** so someone can claim activity they didn't do
  to climb. Custom quests still earn XP only 3 times per category per day and goals twice a day,
  which holds that route to about 4,800 XP a day; removing those too would let anyone reach first
  place instantly. There are no moderation tools yet to remove a cheater or an offensive display
  name: set `show_on_leaderboard = false` on their `player_profile` row, or delete the account.
- **Admin analytics** count from the database only; there's no separate page-view analytics product
  wired in (Vercel's was dropped along with Vercel itself). The dashboard recomputes on every load,
  which is fine at this size but would need caching with many thousands of players.

## Spam protection

- **There's no bot-challenge layer** (Vercel BotID was Vercel-only, and was removed with the move
  off Vercel). A browser-driving bot that waits 3 s, skips the honeypot and uses a real email
  domain can still sign up, at most 5 times an hour per IP. Cloudflare Turnstile (captcha, see
  DEPLOYMENT.md) is the recommended mitigation here.
- The throwaway-domain list is short and hand-kept (`spam-rules.ts`).

## Legal & privacy

- **No contact email yet.** `LEGAL.contactEmail` in `src/lib/legal.ts` is empty until there's a
  domain, so the Terms and Privacy Policy say "contact Ayomide Ogunyemi" without an address.
  Account deletion is self-serve and needs no contact, but data-copy requests do.
- **No data export button.** Players can ask for a copy; there's no self-serve download yet.
- **Age is self-declared.** The minimum is 13; 13–17s tick that a parent or guardian agreed. Nothing
  verifies either, and an under-13 can change their answer and retry (no cookie remembers it).
- **Accounts created before sign-up consent** (migration 0007) have null `age_group` and
  `terms_accepted_at`; they aren't asked again.

## Behaviour by design (documented, may surprise)

- **Quests are generated lazily** when the player opens the app (no background job). Days the player
  never opens AWAKEN generate no quests, so they don't count as missed in analytics. Deadline
  reminders are also created on visit, not pushed.
- **"Not found" under `/system` returns HTTP 200** with a `noindex` tag. Pages there stream behind a
  loading boundary, so the status is sent before `notFound()` runs. Content is identical for "not
  yours" and "doesn't exist" (asserted in E2E). Fix if a real 404 matters: remove
  `src/app/system/loading.tsx` or move the ownership check above the boundary.
- **Time zone / day-start changes** are limited to once every 7 days (prevents farming extra daily
  sets). Changing focus areas or the daily target applies from the next day.
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
| Concurrency (real Postgres) | duplicate grants, custom limits, quest/habit/focus/goal/milestone races, skill unlocks, achievement evaluation, daily generation — needs Docker running, otherwise skipped |
| End-to-end (Playwright, Chromium) | full first session, XP exactly once on double click, level-up at threshold, achievement, focus recovery after reload, progress figures vs. the ledger, sign-in redirects, open-redirect guard, sign-out, cross-player isolation, per-client sign-up rate limit |
| Accessibility | axe (WCAG 2.1 A/AA) on 18 pages with zero serious/critical issues; skip link and visible focus; reduced motion honoured |
| Responsive | no horizontal overflow on 18 pages at Pixel 7 size; every section reachable from the mobile menu |

Not covered: browsers other than Chromium, manual screen-reader testing (VoiceOver/NVDA), load
testing, and a live deployment (the production build was verified locally: CSP, headers, health,
DB-backed rate limits).
