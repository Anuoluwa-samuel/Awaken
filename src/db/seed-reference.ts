import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { ACHIEVEMENTS, SKILLS, SYSTEM_QUEST_TEMPLATES } from "./seed-data";
import type { AppDb } from "./types";

/** Idempotent upserts of quest templates, skills and achievements (keyed by key/code). */
export async function seedReferenceData(db: AppDb) {
  await db
    .insert(schema.questTemplate)
    .values(
      SYSTEM_QUEST_TEMPLATES.map((t) => ({
        key: t.key,
        title: t.title,
        description: t.description,
        category: t.category,
        difficulty: t.difficulty,
        attribute: t.attribute,
        estimatedMinutes: t.estimatedMinutes ?? null,
        cadence: t.cadence,
        weeklyTarget: t.weeklyTarget ?? null,
        requiredSkill: t.requiredSkill ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: schema.questTemplate.key,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        category: sql`excluded.category`,
        difficulty: sql`excluded.difficulty`,
        attribute: sql`excluded.attribute`,
        estimatedMinutes: sql`excluded.estimated_minutes`,
        weeklyTarget: sql`excluded.weekly_target`,
        requiredSkill: sql`excluded.required_skill`,
      },
    });

  await db
    .insert(schema.skill)
    .values(SKILLS.map((s) => ({ ...s })))
    .onConflictDoUpdate({
      target: schema.skill.code,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        requiredLevel: sql`excluded.required_level`,
        prerequisiteCode: sql`excluded.prerequisite_code`,
        cost: sql`excluded.cost`,
        category: sql`excluded.category`,
        available: sql`excluded.available`,
        effect: sql`excluded.effect`,
      },
    });

  await db
    .insert(schema.achievement)
    .values(ACHIEVEMENTS.map((a) => ({ ...a, criteria: { ...a.criteria }, hidden: a.hidden ?? false })))
    .onConflictDoUpdate({
      target: schema.achievement.code,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        icon: sql`excluded.icon`,
        criteria: sql`excluded.criteria`,
        xpReward: sql`excluded.xp_reward`,
        titleReward: sql`excluded.title_reward`,
        hidden: sql`excluded.hidden`,
      },
    });
}
