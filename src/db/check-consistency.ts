import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { checkProgressConsistency, rebuildProgress } from "@/server/services/consistency";
import * as schema from "./schema";
import type { AppDb } from "./types";

// Usage: pnpm db:check            (report only)
//        pnpm db:check --repair   (rebuild caches from the ledgers, audited)
config({ path: ".env.local" });

async function main() {
  const repair = process.argv.includes("--repair");
  const client = postgres(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(client, { schema }) as unknown as AppDb;
  const players = await db.select({ userId: schema.playerProgress.userId }).from(schema.playerProgress);
  let bad = 0;
  for (const { userId } of players) {
    const report = await checkProgressConsistency(db, userId);
    if (report.ok) continue;
    bad++;
    console.warn(`✗ ${userId}`, JSON.stringify(report));
    if (repair) {
      const after = await rebuildProgress(db, userId, null);
      console.info(after.ok ? `  repaired` : `  still inconsistent: ${JSON.stringify(after)}`);
    }
  }
  console.info(`${players.length} players checked, ${bad} inconsistent${repair ? " (repair attempted)" : ""}.`);
  await client.end();
  if (bad > 0 && !repair) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
