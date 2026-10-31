import { config } from "dotenv";
import postgres from "postgres";
import { checkProductionEnv, type Finding } from "../src/lib/deploy-check";

// Usage: pnpm deploy:check [--env-file .env.production.local] [--connect]
// Prints PASS/WARN/FAIL per setting, never the values. Exits 1 on any FAIL.
const args = process.argv.slice(2);
const fileIndex = args.indexOf("--env-file");
if (fileIndex >= 0) config({ path: args[fileIndex + 1], override: true, quiet: true });

const findings: Finding[] = checkProductionEnv(process.env);

if (args.includes("--connect") && process.env.DATABASE_URL) {
  const sql = postgres(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });
  try {
    await sql`select 1`;
    findings.push({ level: "pass", key: "database", message: "reachable" });
    const journal = (await import("../drizzle/meta/_journal.json", { with: { type: "json" } })).default as { entries: unknown[] };
    const [{ n: applied }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`.catch(() => [{ n: 0 }]);
    findings.push(
      applied >= journal.entries.length
        ? { level: "pass", key: "migrations", message: `${applied}/${journal.entries.length} applied` }
        : { level: "fail", key: "migrations", message: `${applied}/${journal.entries.length} applied — run pnpm db:deploy` },
    );
    const [{ n: templates }] = await sql`select count(*)::int as n from quest_template`.catch(() => [{ n: 0 }]);
    findings.push(
      templates > 0
        ? { level: "pass", key: "seed data", message: `${templates} quest templates` }
        : { level: "fail", key: "seed data", message: "missing — run pnpm db:deploy" },
    );
  } catch {
    findings.push({ level: "fail", key: "database", message: "unreachable with the configured URL" });
  } finally {
    await sql.end();
  }
}

const icon = { pass: "PASS", warn: "WARN", fail: "FAIL" } as const;
for (const f of findings) console.log(`${icon[f.level]}  ${f.key.padEnd(28)} ${f.message}`);
const fails = findings.filter((f) => f.level === "fail").length;
console.log(fails ? `\n${fails} problem(s) to fix before deploying.` : "\nReady to deploy.");
process.exit(fails ? 1 : 0);
