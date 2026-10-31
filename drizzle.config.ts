import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations use a direct (unpooled) connection when one is provided — Neon's pooler is in
  // transaction mode, which isn't suitable for DDL in long transactions.
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL! },
  strict: true,
});
