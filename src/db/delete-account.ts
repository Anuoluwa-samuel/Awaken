import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { normaliseEmail } from "../lib/auth/lockout-rules";
import { purgeAccountExtras } from "../server/services/account";
import { assertDatabaseChangeAllowed } from "./safety";
import * as schema from "./schema";

// `pnpm admin:delete-account <email> --yes`: permanently deletes an account when the owner can't
// sign in to use Settings → Danger zone → Delete account themselves (e.g. a forgotten password
// with no email provider configured yet). Does exactly what that self-service flow does —
// purgeAccountExtras, then the user row, which cascades everything else (sessions, credentials,
// profile, quests, ledgers, notifications …) via ON DELETE CASCADE. See src/lib/auth/server.ts.
config({ path: ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const email = normaliseEmail(args.find((a) => !a.startsWith("--")));
  if (!email || !args.includes("--yes")) {
    throw new Error("Usage: pnpm admin:delete-account <email> --yes (the --yes confirms this is permanent)");
  }

  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL!;
  assertDatabaseChangeAllowed(url, "admin:delete-account");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email), columns: { id: true, email: true } });
  if (!existing) {
    await client.end();
    throw new Error(`No account uses ${email}.`);
  }

  await purgeAccountExtras(db, existing.id, existing.email);
  await db.delete(schema.user).where(eq(schema.user.id, existing.id));
  await client.end();
  console.log(`Deleted the account for ${email}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
