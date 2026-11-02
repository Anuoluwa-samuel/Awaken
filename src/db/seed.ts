import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { assertDatabaseChangeAllowed } from "./safety";
import * as schema from "./schema";
import { ACHIEVEMENTS, SKILLS, SYSTEM_QUEST_TEMPLATES } from "./seed-data";
import { seedReferenceData } from "./seed-reference";

export { seedReferenceData };

config({ path: ".env.local" });

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL!;
  assertDatabaseChangeAllowed(url, "db:seed");
  const client = postgres(url, { max: 1 });
  await seedReferenceData(drizzle(client, { schema }));
  await client.end();
  console.log(
    `Seeded ${SYSTEM_QUEST_TEMPLATES.length} quest templates, ${SKILLS.length} skills, ${ACHIEVEMENTS.length} achievements.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
