import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { assertDatabaseChangeAllowed } from "./src/db/safety";

config({ path: ".env.local" });

const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL!;
// `generate` only compares files and never connects, so it needs no check.
if (!process.argv.includes("generate")) assertDatabaseChangeAllowed(url, "drizzle-kit");

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations use a direct (unpooled) connection when one is provided — a managed Postgres's
  // pooler (if you use one) is typically in transaction mode, which isn't suitable for DDL in
  // long transactions. A self-hosted Postgres container has no pooler, so DATABASE_URL works
  // for both.
  dbCredentials: { url },
  strict: true,
});
