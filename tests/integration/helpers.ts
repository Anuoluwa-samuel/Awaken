import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";
import { seedReferenceData } from "@/db/seed-reference";
import type { AppDb } from "@/db/types";

/** A fresh in-process Postgres with migrations and reference data applied. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await seedReferenceData(db as unknown as AppDb);
  return { db: db as unknown as AppDb, close: () => client.close() };
}

export async function createUser(db: AppDb, id = crypto.randomUUID()) {
  await db.insert(schema.user).values({ id, name: "Test", email: `${id}@example.test` });
  return id;
}
