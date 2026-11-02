@AGENTS.md

# The real database is off limits

The production database holds real players' data. This rule has no exceptions:

- **Never run anything against the real database:** no reads, writes, migrations, seeds, repairs or tests.
- **Every test, experiment or manual check uses a temporary database** that has nothing to do with the
  real one: `pnpm db:temp`, PGlite, `awaken_e2e`, or the temp databases the race tests create. Drop it
  afterwards. Don't experiment on the long-lived local dev database either.
- **A production change is the owner's decision, each time.** Propose it and wait for an explicit yes for
  that specific change. The owner supplies the connection through a hidden prompt; never ask for or
  accept a database URL in chat. Confirm a recent backup exists first.
- **Don't weaken the guards** in `src/db/safety.ts`, and don't set `CONFIRM_PRODUCTION_DB` yourself.
