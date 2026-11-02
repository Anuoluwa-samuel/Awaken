import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { assertLocalDatabase } from "@/db/safety";
import { seedReferenceData } from "@/db/seed-reference";
import type { AppDb } from "@/db/types";

config({ path: ".env.local", quiet: true });

/**
 * A throwaway database on the real Postgres server from DATABASE_URL, for tests that need
 * genuinely concurrent connections (PGlite is single-connection). Returns null when no
 * server is reachable so the suite can skip instead of failing.
 */
export async function createPgTestDb() {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return null;
  assertLocalDatabase(url, "the concurrency tests");
  const admin = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 3 });
  try {
    await admin`select 1`;
  } catch {
    await admin.end();
    return null;
  }
  const name = `awaken_test_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await admin.unsafe(`create database ${name}`);
  const testUrl = new URL(url);
  testUrl.pathname = `/${name}`;
  const client = postgres(testUrl.toString(), { max: 20, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await seedReferenceData(db as unknown as AppDb);

  return {
    db: db as unknown as AppDb,
    async close() {
      await client.end();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
