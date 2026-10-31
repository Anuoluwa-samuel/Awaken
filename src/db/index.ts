import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

function createClient() {
  const url = new URL(env.DATABASE_URL);
  // Neon's pooled endpoint (host contains "-pooler") runs PgBouncer in transaction mode,
  // which doesn't support named prepared statements.
  const pooled = url.hostname.includes("-pooler");
  return postgres(env.DATABASE_URL, {
    // Serverless functions each hold their own pool: keep it tiny on Vercel.
    max: env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 1 : 10),
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
