// A throwaway local database for tests and manual checks, unrelated to any real data.
//   pnpm db:temp              creates one (migrated and seeded) and prints how to use it
//   pnpm db:temp drop <name>  removes it
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { assertLocalDatabase } from "../src/db/safety";
import * as schema from "../src/db/schema";
import { seedReferenceData } from "../src/db/seed-reference";
import type { AppDb } from "../src/db/types";

config({ path: ".env.local", quiet: true });

const server = process.env.DATABASE_URL ?? "postgres://awaken:awaken@localhost:54350/awaken";
assertLocalDatabase(server, "db:temp");

const [command, target] = process.argv.slice(2);
const admin = postgres(server, { max: 1, onnotice: () => {} });

if (command === "drop") {
  // The prefix check means this can only ever remove a database this script created.
  if (!/^awaken_temp_[a-f0-9]+$/.test(target ?? "")) throw new Error("Usage: pnpm db:temp drop awaken_temp_<id>");
  await admin.unsafe(`drop database if exists ${target} with (force)`);
  console.log(`Dropped ${target}.`);
} else {
  const name = `awaken_temp_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await admin.unsafe(`create database ${name}`);
  const url = new URL(server);
  url.pathname = `/${name}`;
  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await seedReferenceData(db as unknown as AppDb);
  await client.end();
  console.log(`Created ${name}.\nUse it with: DATABASE_URL=${url}\nRemove it with: pnpm db:temp drop ${name}`);
}
await admin.end();
