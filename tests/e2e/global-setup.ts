import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { assertLocalDatabase } from "../../src/db/safety";
import * as schema from "../../src/db/schema";
import { seedReferenceData } from "../../src/db/seed-reference";
import type { AppDb } from "../../src/db/types";
import { E2E_DATABASE_URL } from "../../playwright.config";

/** Recreates the E2E database from migrations + seed data before every run. */
export default async function globalSetup() {
  assertLocalDatabase(E2E_DATABASE_URL, "the browser tests");
  const target = new URL(E2E_DATABASE_URL);
  const name = target.pathname.slice(1);
  const adminUrl = new URL(E2E_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
  await admin.end();

  const client = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await seedReferenceData(db as unknown as AppDb);
  await client.end();
}
