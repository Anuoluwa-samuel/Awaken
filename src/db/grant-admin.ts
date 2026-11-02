import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { normaliseEmail } from "../lib/auth/lockout-rules";
import { assertDatabaseChangeAllowed } from "./safety";
import * as schema from "./schema";

// `pnpm admin:grant <email> [--revoke]`: gives an existing account access to /admin, or removes it.
// A database-only step on purpose: nothing in the app or its API can make someone an admin.
config({ path: ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = normaliseEmail(args.find((a) => !a.startsWith("--")));
  if (!email) throw new Error("Usage: pnpm admin:grant <email> [--revoke]");

  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL!;
  assertDatabaseChangeAllowed(url, "admin:grant");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });
  const role = revoke ? "player" : "admin";
  const [updated] = await db
    .update(schema.user)
    .set({ role })
    .where(eq(schema.user.email, email))
    .returning({ id: schema.user.id });
  if (updated) {
    await db.insert(schema.auditEvent).values({ action: `admin.${revoke ? "revoked" : "granted"}`, targetType: "user", targetId: updated.id });
  }
  await client.end();
  if (!updated) throw new Error(`No account uses ${email}. Sign up first, then run this again.`);
  console.log(`${email} is now: ${role}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
