// Guards that keep tools away from the real database. See CLAUDE.md. No imports: used by config
// files, scripts, tests and the app alike.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalDatabase(url: string | undefined) {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Tests and experiments: local only, with no way to override. */
export function assertLocalDatabase(url: string | undefined, purpose: string) {
  if (!isLocalDatabase(url)) {
    throw new Error(`Refusing to run ${purpose}: the database isn't local. Tests only ever use a temporary local database.`);
  }
}

/**
 * Commands that change a database (migrate, seed, grant, repair). Remote targets need
 * CONFIRM_PRODUCTION_DB=yes, which only `pnpm db:deploy` and deliberate commands set, so a production URL
 * left in a shell can't be changed by accident. Never prints the URL.
 */
export function assertDatabaseChangeAllowed(url: string | undefined, command: string) {
  if (isLocalDatabase(url) || process.env.CONFIRM_PRODUCTION_DB === "yes") return;
  throw new Error(
    `Refusing to run ${command} against a remote database. If you really mean production, back it up first and set CONFIRM_PRODUCTION_DB=yes.`,
  );
}
