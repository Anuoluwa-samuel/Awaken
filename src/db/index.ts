import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { assertLocalDatabase } from "./safety";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

function createClient() {
  // `pnpm dev` and tests must never be able to reach a real database.
  if (process.env.NODE_ENV !== "production") assertLocalDatabase(env.DATABASE_URL, "the app in development");
  const url = new URL(env.DATABASE_URL);
  // A serverless host with a PgBouncer-style pooler (host contains "-pooler") runs transaction
  // mode, which doesn't support named prepared statements. Not the case for a plain self-hosted
  // Postgres container, which supports them.
  const pooled = url.hostname.includes("-pooler");
  return postgres(env.DATABASE_URL, {
    max: env.DATABASE_POOL_MAX ?? 10,
    prepare: !pooled,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Reuse the client across hot reloads in development.
const client = globalForDb.pgClient ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
