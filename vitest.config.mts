import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    // Integration suites boot an in-process Postgres and run migrations in beforeAll;
    // allow for that on a busy machine.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
