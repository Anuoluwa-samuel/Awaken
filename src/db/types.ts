import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database or transaction with our schema: the postgres-js
 * client in the app, PGlite in integration tests. Services accept this so they
 * can be tested against a real database without Next.js.
 */
export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;
