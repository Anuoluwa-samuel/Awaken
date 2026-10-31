# AWAKEN — Architecture & Game Design (Phase 1)

This document is the source of truth for how AWAKEN works. Numbers quoted
here live in code under `src/lib/progression/config.ts`; if the two ever
disagree, the code wins and this file is out of date.

---

## 1. Application architecture

```
Browser ──► Next.js 16 (App Router)
             ├─ proxy.ts ............ optimistic redirect for /system/* without a session cookie
             ├─ app/(public), (auth) . marketing + auth pages (Server Components + small client forms)
             ├─ app/onboarding ....... first-run setup (server action)
             ├─ app/system/* ......... player app (Server Components read via services)
             ├─ app/api/auth/[...all]  Better Auth handler
             └─ server actions ....... every mutation (complete quest, create quest, …)
                    │
                    ▼
             src/server/services ..... business rules, authorization, transactions
             src/server/repositories . narrow Drizzle queries, always scoped by userId
             src/lib/progression ..... PURE functions: XP curve, levels, ranks, rewards
             src/lib/time ............ PURE functions: player day boundaries
                    │
                    ▼
             PostgreSQL (Drizzle ORM, SQL migrations in /drizzle)
```

Key decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js 16.4 App Router, React 19.3, TS strict | Requested stack. |
| Cache Components | **Disabled** (`cacheComponents: false`) | Nearly every page is per-player request-time data. Cache Components would force Suspense around every session read for no caching benefit. Revisit for the public landing page only. |
| Auth | Better Auth 1.7 (email + password, email verification, password reset, DB sessions, built-in rate limiting) with the Drizzle adapter | Maintained, self-hosted, stores sessions in our Postgres, supports every required flow. |
| Email delivery | `src/lib/email.ts`: SMTP-less **console transport in development**, explicit error in production until a provider is configured | We never pretend an email was sent. |
| Mutations | Server Actions calling services; route handlers only for auth and future integrations | Keeps privileged logic server-side, typed end to end. |
| Validation | Zod schemas in `src/lib/validation`, shared by forms (React Hook Form) and actions | One definition, validated twice, trusted once (server). |
| Progression maths | Pure, deterministic, unit-tested modules with no DB or React imports | Testable in isolation, reusable by services and UI previews. |
| Tests | Vitest (unit + integration against **PGlite**, an in-process Postgres), RTL for components, Playwright for E2E against Docker Postgres | Integration tests run real SQL and constraints without needing a server. |

Separation rule: components never compute rewards. They render values the
server computed. The UI may *preview* ("+25 XP") using the same pure config,
but the server recomputes everything on submit.

---

## 2. Database schema

All tables use `text` primary keys (UUIDv4 / Better Auth ids), `timestamptz`
timestamps stored in UTC, and `ON DELETE CASCADE` from `user`. Every
player-owned row carries `user_id` so every query can be scoped.

### Auth (Better Auth-owned)
- `user` (id, name, email unique, email_verified, image, created_at, updated_at)
- `session` (id, token unique, user_id → user, expires_at, ip_address, user_agent, …)
- `account` (id, user_id → user, provider_id, account_id, password hash, …)
- `verification` (id, identifier, value, expires_at, …) — email verification & reset tokens

### Player
- `player_profile` — user_id PK/FK, display_name, time_zone (IANA), day_start_hour (0–23),
  focus_areas text[], preferred_difficulty, daily_target (nullable), avatar_url,
  equipped_title_id, onboarded_at, created_at, updated_at
- `player_progress` — **cache** derived from the ledger: user_id PK, total_xp, level,
  rank, skill_points_earned, skill_points_spent, updated_at. Verifiable with
  `SUM(xp_ledger.amount) = total_xp` (consistency check in Phase 3).
- `player_attribute` — (user_id, attribute) PK, points. `attribute` ∈
  strength | intelligence | discipline | vitality | creativity.
- `attribute_ledger` — append-only attribute gains (user_id, attribute, amount,
  source_type, source_id, idempotency_key **unique**, created_at).

### Quests
- `quest_template` — system or player-authored templates: id, owner_user_id
  (null = system), title, description, category, difficulty, attribute,
  xp_reward (null = difficulty default), estimated_minutes, cadence
  (`daily` | `weekly` | `once`), is_active, created_at.
- `player_quest` — a concrete quest instance: id, user_id, template_id (nullable
  for one-off custom quests), kind (`daily` | `weekly` | `custom`), title,
  description, category, difficulty, attribute, **xp_reward (snapshotted at
  creation)**, quest_date (`date`, the player's local quest day), due_at,
  status, estimated_minutes, evidence_note, started_at, completed_at,
  created_at, updated_at.
  **Unique (user_id, template_id, quest_date)** — prevents duplicate daily sets.
- `quest_completion` — id, player_quest_id **unique**, user_id, method
  (`self_reported` | `focus_session` | `habit` | `integration`), evidence_note,
  completed_at. The unique FK is the second line of defence against double completion.
- `weekly_challenge` — id, user_id, title, category, target, progress,
  week_start (`date`), deadline_at, xp_reward, status, completed_at,
  reward_claimed_at. Unique (user_id, template_key, week_start).

### Rewards
- `xp_ledger` — id, user_id, event_type (`quest_completed` | `weekly_completed` |
  `achievement_unlocked` | `focus_completed` | `goal_completed` | `adjustment`),
  source_type, source_id, amount (int, may be negative only for `adjustment`),
  reason, **idempotency_key unique**, created_at.
- `level_event` — user_id, from_level, to_level, from_rank, to_rank, ledger_id, created_at.

### Habits, skills, achievements, focus, goals, notifications (schema in Phase 2, logic in later phases)
- `habit` (id, user_id, name, description, category, schedule_days int[] (0=Sun),
  target_per_week, attribute, linked_template_id, reminder_time, archived_at, …)
- `habit_completion` (id, habit_id, user_id, local_date, completed_at) — **unique (habit_id, local_date)**
- `skill` (id/code, name, description, category, required_level, prerequisite_code, cost, effect json)
- `player_skill` (user_id, skill_code) PK, unlocked_at
- `achievement` (code PK, name, description, icon, criteria json, xp_reward, title_reward)
- `player_achievement` (user_id, achievement_code) PK, unlocked_at
- `player_title` (user_id, title) PK, source, earned_at
- `focus_session` (id, user_id, player_quest_id, planned_seconds, started_at,
  paused_at, total_paused_seconds, ended_at, status, credited_seconds)
- `goal` (id, user_id, title, description, category, deadline, status, completed_at)
- `goal_milestone` (id, goal_id, user_id, title, position, player_quest_id, completed_at)
- `notification` (id, user_id, type, title, body, href, **dedupe_key unique**, read_at, created_at)
- `audit_event` (id, actor_user_id, action, target_type, target_id, metadata json, created_at)

Indexes: `(user_id, quest_date)`, `(user_id, status)` on `player_quest`;
`(user_id, created_at)` on `xp_ledger`, `notification`, `habit_completion`.

---

## 3. XP and level formulas

Default XP by difficulty: **easy 10 · normal 25 · hard 50 · elite 100**.
Custom quests may set an explicit reward, clamped server-side to
`[5, maxForDifficulty]` where max = 2× the difficulty default.

**Lifetime XP is the stored value. Level and in-level progress are derived.**

XP needed to go from level `L` to `L+1`:

```
step(L) = BASE + INCREMENT × (L − 1)        BASE = 100, INCREMENT = 20
```

Cumulative XP to *reach* level `L`:

```
xpToReach(L) = BASE·(L−1) + (INCREMENT/2)·(L−1)·(L−2)
```

| Level | Lifetime XP | Days @150 XP/day | Days @250 XP/day |
|---|---:|---:|---:|
| 2 | 100 | 1 | <1 |
| 5 | 520 | 3 | 2 |
| 10 | 1,620 | 11 | 6 |
| 20 | 5,320 | 35 | 21 |
| 50 | 28,420 | 189 | 114 |
| 70 | 53,820 | 359 | 215 |
| 90 | 87,220 | 581 | 349 |

`levelFromXp(xp)` returns the highest `L` with `xpToReach(L) ≤ xp`, so one
large reward can cross several levels; the reward service records one
`level_event` per grant spanning `from_level → to_level`.

Anti-grind safeguards (enforced on the server, shown to the user):
- **Daily quest-XP soft cap: 400 XP per player day** from quests/focus. Beyond
  it, completions are still recorded but award 0 XP, with the reason stated.
  Achievements and weekly challenges are not capped.
- Custom quests: max **3 rewarded completions per category per day**; a
  recurring custom quest can be rewarded at most once per day.
- Rewards snapshot onto the quest at creation; editing a quest's difficulty
  after creation shows the new value before saving and never re-grants.

Skill points: **1 per level gained** (level 2 onward) plus any achievement that grants one.

## 4. Rank thresholds

Rank is derived from level (one config table):

| Rank | Levels |
|---|---|
| E-Rank | 1–9 |
| D-Rank | 10–19 |
| C-Rank | 20–34 |
| B-Rank | 35–49 |
| A-Rank | 50–69 |
| S-Rank | 70–89 |
| National-Level | 90+ |

At ~150 XP/day a consistent player reaches S-Rank in about a year.

## 5. Attributes

Each quest has one focus attribute. On completion it gains
**easy 1 · normal 2 · hard 3 · elite 5** points, capped at **10 points per
attribute per player day**. Every *scheduled daily* quest completed before
it expires also gives **+1 Discipline**. Default mapping by category:
fitness → Strength, learning/career → Intelligence, organization/finance →
Discipline, wellbeing/social → Vitality, creativity → Creativity.
Attributes are game mechanics, not measurements of ability or health.

## 6. Daily quest lifecycle

**Quest day.** A player's quest day is the local calendar date in their IANA
time zone, shifted by `day_start_hour` (default 4 → a day runs 04:00–03:59
local). `questDay(now, tz, startHour)` is a pure, tested function; the server
clock's zone is never used.

**States.**

```
            start            complete (tx + reward)
available ───────► in_progress ───────────► completed   (terminal)
    │                   │
    │ cancel            │ cancel
    ├───────────────────┴──────► cancelled  (terminal, no XP)
    │ day rollover
    └───────────────────────────► expired    (terminal, no XP, history kept)
```
`available → completed` is also allowed directly. Rewards are granted
automatically on completion (no separate "claimed" state for quests).
Weekly challenges add a `reward_claimed_at` timestamp because the reward is
granted when the target is first reached.

**Generation (lazy + idempotent).** On any `/system` load the server calls
`ensureDailyQuests(userId, now)`:
1. Compute today's quest day.
2. `UPDATE player_quest SET status='expired' WHERE kind='daily' AND quest_date < today AND status IN ('available','in_progress')`.
3. `INSERT … SELECT active daily templates … ON CONFLICT (user_id, template_id, quest_date) DO NOTHING`.

Concurrent loads therefore cannot duplicate a day's quests. Missed quests
never touch the ledger, so lifetime XP is never reduced. A scheduled job
(`/api/cron/daily`) can call the same function later for notifications.

## 6a. Quest completion, custom quests & weekly challenges (Phase 4)

**Completion** (`completeQuest` in `src/server/services/quests.ts`), one transaction:

1. Lock the quest row **scoped to the owner** (`WHERE id = $1 AND user_id = $2 FOR UPDATE`).
   Another player's quest is reported as not found — never "forbidden" — so ids can't be probed.
2. Already `completed` → return `already_completed`, grant nothing.
   Other terminal states → `INVALID_STATE`.
3. Scheduled quests (system or recurring custom) can only be completed on their own quest day
   (`NOT_TODAY`), even if the rollover hasn't run yet; one-off quests until their deadline (`PAST_DUE`).
4. Lock the player (`player_progress FOR UPDATE`), then apply the custom-quest limit.
5. Insert `quest_completion` (unique per quest), mark the quest completed.
6. `grantXp` (`quest:{id}`), attribute points (`quest:{id}:attr:{attribute}`) and, for system
   daily quests, +1 Discipline (`quest:{id}:attr:discipline-bonus`).
7. Advance this week's matching challenges; reaching a target grants `weekly:{challengeId}` once.

**Lock order** is always quest row → player row → weekly challenge rows, so there are no
deadlock cycles. Everything counted for a limit is counted under the player lock.

Completions are **self-reported** (`method = self_reported`) and labelled as such in the UI;
the System never claims to have verified a workout or study session.

**Custom quests** (`createCustomQuest`):

| Rule | Value |
|---|---|
| XP | difficulty default, or a requested value clamped to `[5, 2 × default]`; snapshotted at creation |
| Attribute | chosen, or derived from the category |
| One-time | open until completed, cancelled, or the end of its optional target date (player's zone) |
| Recurring | a private template + schedule (days of week); one quest per scheduled day, rewarded at most once per day |
| Rewarded completions | 3 per category per quest day; further completions are recorded with 0 XP and an explanation |
| Open one-time quests | 30 per player |
| Active recurring quests | 10 per player |

Player-authored recurring quests are generated with `kind = custom`, so custom limits apply to them;
`ensureDailyQuests` only ever schedules system templates or the player's own.

**Weekly challenges** (`src/server/services/weekly.ts`): weeks run Monday–Sunday in quest days.
Each week a player gets the system weekly templates matching their focus areas plus "Complete five
planned tasks" (any category counts). Reward = 2 × the difficulty default (100 XP for hard), not
subject to the daily cap. Unique on `(user, template, week_start)`. Unfinished challenges expire at
the deadline. Progress only moves inside a quest completion transaction, is capped at the target,
and the reward is granted when the target is first reached (`reward_claimed_at` records it).

**Notifications.** Level-ups, rank-ups and weekly completions go to the notification feed.
Individual quest completions are shown as an inline system message instead, so the feed isn't
flooded by routine activity.

## 6b. Status window & level-up experience (Phase 5)

- **Level change per completion** is measured across *everything* the completion granted
  (quest XP plus any weekly reward), from the locked progress row before and after, so a
  level-up triggered by a weekly reward is still celebrated.
- **Level-up panel** (`src/components/player/level-up-panel.tsx`): non-modal — the backdrop
  ignores pointer events, focus is not moved, and the rest of the page keeps working. Closes on
  Escape, *Continue*, or after 6 s. Shows the old and new level, levels gained, skill points, and
  the rank promotion with insignia. Reduced motion shows it without animation.
- **Rank insignia** (`rank-emblem.tsx`) are original double-hex plates with per-rank colours.
- **Activity feed** merges `xp_ledger` and `level_event` rows (persisted data only). Each level
  event is placed directly above the grant that caused it; grants that share a timestamp list
  follow-on rewards (weekly, achievements) above the quest that triggered them.
- **Profile** (`/system/profile`): rank ladder with thresholds and progress to the next rank,
  rank-up history, level history, lifetime counters.

## 6c. Habits & streaks (Phase 6)

**Schedules.** *Specific days* (weekdays chosen; other days are rest days) or *N times per
week* (any days, Monday–Sunday weeks). Each habit has a `start_date` (the player's quest day it
was created); nothing earlier counts against it. All dates are quest days in the player's zone.

**Streaks** (`src/lib/progression/habits.ts`, pure and unit-tested):

| | Specific days | Times per week |
|---|---|---|
| Unit | scheduled days | weeks |
| Current | completed scheduled days in a row, walking back from today; rest days are skipped, never break it | consecutive weeks that met the target |
| Today / this week | never counted as missed while still in progress | included once the target is met |
| Longest | best run since the start date | best run of weeks |
| Rate | completed ÷ scheduled days over the last 30 days | weeks met over the last 4 complete weeks |

Missing a day can reset a streak; it never changes XP. Copy is encouraging ("Fresh start today —
your best is 9 days"), never punitive.

**Rewards.** A check-in that *counts toward the schedule* (a scheduled weekday, or within the
weekly target) earns 5 XP (`habit_completed`, counted in the daily quest-XP cap) and 1 point of the
habit's attribute. Rest-day and over-target check-ins are recorded with no reward. Key:
`habit:{habitId}:{questDay}`. One check-in per habit per quest day (unique index).

**Habits linked to a quest** (a scheduled daily template of the player's):
- Checking in completes today's open quest from that template (`method = habit`) and only the
  quest's rewards apply — no habit XP.
- Completing that quest directly records the habit check-in, again with no extra reward.
- If no open linked quest exists today, the check-in falls back to the normal habit reward.

**Locks.** Check-in locks the habit row `FOR NO KEY UPDATE`, then (if linked) quest → player.
Quest completion inserts the linked check-in, whose FK check takes `KEY SHARE` on the habit
row; `NO KEY UPDATE` is compatible with that, which avoids a habit ↔ quest deadlock that the
real-Postgres race test reproduced with `FOR UPDATE`.

Limits: 20 active habits. Archiving keeps history and XP. Reminders are not delivered yet
(notification delivery is Phase 9), so the UI does not offer them.

## 6d. Achievements, titles & skills (Phase 7)

**Achievements** (`src/server/services/achievements.ts`). Criteria are typed
(`quests_completed`, `level`, `category_quests`, `weekly_completed`, `habit_streak`,
`habit_checkins`, `skills_unlocked`) and evaluated by a pure function against metrics computed
from persisted records. `evaluateAchievements` runs inside the transaction of every reward flow
(quest completion, habit check-in, skill unlock) and once per request in the player context
(a catch-up for records that predate an achievement). Each unlock:
`player_achievement` PK → XP via ledger key `achievement:{user}:{code}` (uncapped) → title row →
notification (dedupe key). It repeats until stable, because achievement XP can level the
player into a level achievement. Completion results report unlocks and measure the level change
after them.

**Titles** come from achievements. Equipping validates ownership on the server and only sets
`player_profile.equipped_title`; it grants nothing and changes no progression.

**Skills** (`src/server/services/skills.ts`). One skill point per level gained. Unlocking runs
under the player lock and checks, via the shared pure `skillBlocker`: not already unlocked,
feature available, level requirement, prerequisite, enough points. The `player_skill` PK is the
backstop against double unlocks. Effects add content and never change XP values:

| Skill | Level | Cost | Requires | Effect |
|---|---|---|---|---|
| Early Bird | 3 | 1 | — | schedules the *morning routine* daily quest |
| Consistency | 5 | 1 | Early Bird | weekday insights on each habit |
| Deep Focus | 5 | 1 | — | 50- and 90-minute focus sessions |
| Quick Learner | 8 | 2 | Early Bird | *Advanced study block* weekly challenge (6 learning quests) |
| Creator | 10 | 2 | Consistency | *Build something for 45 minutes* daily quest |

Skill-gated templates carry `quest_template.required_skill`; daily generation and weekly
assignment skip them unless the player has the skill, even if a schedule row exists.

**Rank-up history** is shown on `/system/profile` (Phase 5), sourced from `level_event`.

## 6e. Focus sessions & goals (Phase 8)

**Focus** (`src/server/services/focus.ts`, pure timing in `src/lib/progression/focus.ts`).
The server stores `started_at`, `paused_at` and `total_paused_seconds` and computes focused
time itself: `elapsed = (now − started) − paused`. **Paused time never counts.** The client shows a
countdown derived from those timestamps plus the measured server/device clock offset, re-rendered
on an interval (no decrementing counter), so a refresh, a closed tab or a throttled background tab
recovers exactly. When the countdown reaches zero the client asks the server to complete; the server
re-checks that the session is full (2 s tolerance) and rejects anything early.

| Rule | Value |
|---|---|
| Lengths | 10–45 min; up to 90 min with the Deep Focus skill (presets 15/25/45, +50/90) |
| Active sessions | one per player (partial unique index on running/paused) — a second start returns the active one |
| Full session reward | round(minutes × 0.4) XP (25 min → 10) + 1 Discipline; key `focus:{id}`; counts toward the daily cap |
| Ended early | status `abandoned`, credited focused seconds recorded, **no XP** |
| Linked quest | completed by the session when still open and its estimate ≤ session length → quest rewards only (`method = focus_session`); otherwise the focus reward applies and the player is told why |
| Breaks | 5 min, or 15 min after every 4th full session today; client-only (localStorage, server-time based), skippable, earn nothing |

Focus can't verify attention — like every completion it is self-reported time.

**Goals** (`src/server/services/goals.ts`, completion in `goal-links.ts`). Progress =
completed milestones ÷ milestones; nothing else moves it. Milestones are checked off by the player
or completed through a linked quest: "Make quest" creates a one-off custom quest for a milestone
(one quest per milestone, partial unique index). Completing either side completes both, and the
quest's reward is the only reward for that step. When the last milestone completes, the goal
completes and may earn:

- `10 XP × milestones` (max 100), key `goal:{id}`, **only if** it has ≥ 2 milestones, was created on
  an earlier quest day, and fewer than 2 goals were rewarded today. Otherwise it is recorded with
  the reason shown. The goals page shows the prospective reward up front.
- A notification, and achievement evaluation (*Finisher*).

**Lock order everywhere:** focus row / habit row → quest row → player row → goal row → weekly rows.
`completeGoalIfDone` locks the goal before re-reading milestones, so when the last milestones finish
in parallel exactly one transaction completes the goal (verified with real-Postgres races mixing
milestone, quest and focus completions).

## 6f. Progress analytics & notifications (Phase 9)

**Analytics** (`/system/progress`, `src/server/services/analytics.ts`). Ranges: 7 / 30 / 90 days
and 1 year (links, so every view is shareable and works without JavaScript). All figures come from
persisted records, bucketed by the player's quest day in their own time zone:

| Metric | Source |
|---|---|
| XP over time | `xp_ledger` (zero-filled per day; weekly buckets past 60 days) |
| Quests completed / by category | `quest_completion` ⨝ `player_quest` |
| Daily quest rate | scheduled `player_quest` outcomes: completed ÷ (completed + expired + cancelled); today's open quests count as neither |
| Attribute progression | `attribute_ledger`, cumulative from the pre-range total |
| Focus time | `focus_session.credited_seconds` (incl. sessions ended early) |
| Habit rates & streaks | `habit_completion` with the habit's schedule (archived habits keep their history) |
| Goals, achievements | `goal.completed_at`, `player_achievement.unlocked_at` |
| Day streak | distinct completion days |

Historical meaning of edge cases: cancelled and expired quests stay as "missed" on their day;
quests are never edited after creation (rewards are snapshotted), so history can't shift;
deleting/archiving keeps records. Days the player never opened the app generated no quests, so they
can't count as missed — consistent with "missing a day never punishes".

Charts (Recharts) follow the dataviz rules: one y-axis per chart, fixed categorical slot order
(validated on the dark panel surface: worst adjacent CVD ΔE 8.4, all ≥ 3:1), a neutral grey for
"missed" rather than a status colour, legends for ≥ 2 series, hover tooltips, a *Show table* view
under every chart, and no grow-in animation for reduced-motion users.

Implementation note: the quest-day expression is parameterised (time zone, start hour), so
`GROUP BY` uses column position — repeating the expression binds new parameters, which Postgres
rejects as a different expression.

**Notifications** (`src/server/services/notifications.ts`). Types: level-up, rank-up,
achievement, weekly challenge, goal completed, *daily quests available* (once per quest day,
when that day's set is first generated) and *deadline* reminders — goals due within 2 days, one-off
quests and unfinished weekly challenges ending within 24 hours — generated lazily per request.
Every row has a unique dedupe key (`daily:{user}:{day}`, `deadline:goal:{id}:{deadline}`, …),
so nothing duplicates under refreshes or parallel requests. Read state: opening a notification
marks it read; *Mark all read*; both are scoped to the owner. The header bell shows the latest six
and the unread count; the page paginates by creation time. Individual quest completions are shown
inline rather than as notifications. Browser/email delivery is not implemented, and AWAKEN never
asks for browser notification permission.

## 7. Reward ledger & duplicate prevention

All XP and attribute writes go through `src/server/services/rewards.ts`
(`grantXp`, `grantAttribute`). Callers pass a transaction so a reward commits
or rolls back together with the action that earned it.

`grantXp(tx, grant)`:

1. `SELECT … FROM player_progress WHERE user_id = $1 FOR UPDATE` — every reward
   write for a player is serialized on this row. This is also what makes the
   daily cap race-free: two parallel grants cannot both read "390 earned".
2. If `xp_ledger.idempotency_key` already exists → return `duplicate`, change nothing.
3. For capped events (`quest_completed`, `focus_completed`) sum today's capped
   XP inside the player's quest-day window and clamp the grant (§3). A capped
   grant is still written, with `amount` reduced (possibly 0) and the reason
   appended, so the player can see why.
4. `INSERT INTO xp_ledger … ON CONFLICT (idempotency_key) DO NOTHING` — the
   unique key is the backstop if the lock were ever bypassed.
5. Recompute level/rank/skill points with the pure functions and update
   `player_progress`.
6. If the level changed, insert one `level_event` (unique per ledger row) and a
   `level_up` notification (dedupe key `level:{user}:{level}`); on a rank change a
   `rank_up` notification (`rank:{user}:{rank}`).

`grantAttribute` follows the same pattern against `attribute_ledger`, capped
per attribute per quest day.

Idempotency keys (one per reward-earning fact):

| Source | Key |
|---|---|
| Quest completion | `quest:{playerQuestId}` |
| Quest attribute gain | `quest:{playerQuestId}:attr:{attribute}` |
| Weekly challenge | `weekly:{challengeId}` |
| Achievement | `achievement:{userId}:{code}` (uncapped) |
| Habit check-in | `habit:{habitId}:{questDay}` (+ `:attr`) |
| Focus session | `focus:{sessionId}` (+ `:attr`) |
| Goal completion | `goal:{goalId}` |

Quest completion additionally locks the `player_quest` row and inserts a
`quest_completion` row (unique per quest), giving three independent guards (§6a). The client never sends an XP amount, level, or rank.

**Consistency.** The ledgers are the source of truth; `player_progress` and
`player_attribute` are caches. `checkProgressConsistency` compares them and
`rebuildProgress` rewrites the caches from the ledgers (never the ledgers),
recording a `progress.rebuilt` audit event. Run `pnpm db:check` to report all
players, `pnpm db:check --repair` to fix drift.

**Tests.** `tests/integration/rewards.test.ts` (PGlite) covers grants, duplicates,
exact-threshold and multi-level-ups, rank-ups, caps and their day boundary,
rollback, isolation and rebuild. `tests/integration/concurrency.pg.test.ts` runs
against the real Postgres server with 15–40 truly parallel transactions; it
creates and drops a throwaway database and skips if no server is reachable.

## 8. Route map

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Auth |
| `/onboarding` | Player setup (skippable) |
| `/system` | Status window (dashboard) |
| `/system/quests`, `/system/quests/[id]` | Daily, weekly, custom quests |
| `/system/habits` · `/system/focus` · `/system/skills` · `/system/achievements` · `/system/goals` · `/system/progress` · `/system/notifications` · `/system/profile` · `/system/settings` | Modules |
| `/admin/*` | Deferred until global templates need editing |
| `/api/auth/[...all]` | Better Auth |

## 9. Implementation checklist

- [x] Phase 1 — Architecture, schema, formulas, lifecycle, ledger strategy (this doc)
- [x] Phase 2 — Next.js + TS strict + Tailwind, Drizzle + Postgres, full schema & migration,
      Better Auth (register/login/logout/verify/reset), onboarding → player + attributes + starter quests,
      visual system + app shell, progression/time pure modules with unit tests
- [x] Phase 3 — Reward service, ledger, level events, notifications, consistency check + repair, integration and concurrency tests
- [x] Phase 4 — Completion flow, custom quest builder + safeguards, weekly challenges, quest detail & reward history, idempotency/concurrency tests
- [x] Phase 5 — Status window (rank insignia, rank progress, skill points), level-up panel, activity feed, profile with rank ladder and history
- [x] Phase 6 — Habits (day / weekly schedules, rest days), streaks, rates, heatmap, quest links with single-reward rule, mobile menu
- [x] Phase 7 — Achievement engine + catch-up, titles, skill tree with real effects, unlock messages, races tested
- [x] Phase 8 — Server-timed focus sessions with recovery, pauses, breaks, quest links; goals with milestones, quest links, guarded rewards
- [x] Phase 9 — Progress analytics with range filters, charts + tables; notifications with read state, daily and deadline reminders, header panel
- [x] Phase 10 — Playwright E2E (journey, security, isolation, rate limits), axe accessibility on all pages, mobile overflow checks, fixes, docs/LIMITATIONS.md
- [x] Phase 11 — Vercel + Neon + Resend: Resend email, DB-backed rate limits keyed on x-vercel-forwarded-for, pooled/direct Neon URLs, security headers + CSP, /api/health, global error page, deploy:check, CI workflow, docs/DEPLOYMENT.md
