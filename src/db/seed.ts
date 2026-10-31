import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import * as schema from "./schema";
import { ACHIEVEMENTS, SKILLS, SYSTEM_QUEST_TEMPLATES } from "./seed-data";
import { seedReferenceData } from "./seed-reference";

export { seedReferenceData };

config({ path: ".env.local" });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 });
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
