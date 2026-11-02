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
  // Migrations use a direct (unpooled) connection when one is provided — Neon's pooler is in
  // transaction mode, which isn't suitable for DDL in long transactions.
  dbCredentials: { url },
  strict: true,
});
