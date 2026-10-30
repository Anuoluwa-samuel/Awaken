import { and, asc, eq, sql } from "drizzle-orm";
import { playerProgress, playerQuestSchedule, playerSkill, questTemplate, skill } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { skillBlocker, type SkillBlocker } from "@/lib/progression/achievements";
import { evaluateAchievements, type UnlockedAchievement } from "./achievements";
import { ensureDailyQuests } from "./quests";
import { lockProgress } from "./rewards";
import { ensureWeeklyChallenges } from "./weekly";

// Skill tree — docs/ARCHITECTURE.md §6d. Skill points come from levels (1 per level gained);
// unlocking spends them. Every rule is checked on the server under the player lock.

export class SkillError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | SkillBlocker["reason"],
    message: string,
  ) {
    super(message);
  }
}

function blockerMessage(b: SkillBlocker, names: Map<string, string>): string {
  switch (b.reason) {
    case "unlocked":
      return "Already unlocked.";
    case "unavailable":
      return "This skill arrives with a later update.";
    case "level":
      return `Requires level ${b.requiredLevel}.`;
    case "prerequisite":
      return `Requires ${names.get(b.prerequisiteCode) ?? b.prerequisiteCode} first.`;
    case "points":
      return `Needs ${b.cost} skill point${b.cost === 1 ? "" : "s"}; you have ${b.available}.`;
  }
}

export async function listSkillTree(db: AppDb, userId: string) {
  const [skills, owned, progress] = await Promise.all([
    db.query.skill.findMany({ orderBy: [asc(skill.requiredLevel), asc(skill.code)] }),
    db.query.playerSkill.findMany({ where: eq(playerSkill.userId, userId) }),
    db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) }),
  ]);
  const unlocked = new Set(owned.map((o) => o.skillCode));
  const unlockedAt = new Map(owned.map((o) => [o.skillCode, o.unlockedAt]));
  const pointsAvailable = (progress?.skillPointsEarned ?? 0) - (progress?.skillPointsSpent ?? 0);
  const names = new Map(skills.map((s) => [s.code, s.name]));
  const player = { level: progress?.level ?? 1, pointsAvailable, unlocked };
  return {
    pointsAvailable,
    pointsEarned: progress?.skillPointsEarned ?? 0,
    level: player.level,
    skills: skills.map((s) => {
      const blocker = skillBlocker(s, player);
      return {
        ...s,
        unlockedAt: unlockedAt.get(s.code) ?? null,
        canUnlock: blocker === null,
        blocker,
        blockerMessage: blocker && blocker.reason !== "unlocked" ? blockerMessage(blocker, names) : null,
        prerequisiteName: s.prerequisiteCode ? (names.get(s.prerequisiteCode) ?? null) : null,
      };
    }),
  };
}

export async function hasSkill(db: AppDb, userId: string, code: string) {
  const row = await db.query.playerSkill.findFirst({
    where: and(eq(playerSkill.userId, userId), eq(playerSkill.skillCode, code)),
  });
  return !!row;
}

/** Unlocks a skill exactly once, spends its points, and applies its effect. */
export async function unlockSkill(
  db: AppDb,
  userId: string,
  code: string,
  now = new Date(),
): Promise<{ code: string; name: string; achievements: UnlockedAchievement[] }> {
  const result = await db.transaction(async (tx) => {
    const progress = await lockProgress(tx, userId);
    const target = await tx.query.skill.findFirst({ where: eq(skill.code, code) });
    if (!target) throw new SkillError("NOT_FOUND", "Skill not found");

    const owned = await tx.select({ code: playerSkill.skillCode }).from(playerSkill).where(eq(playerSkill.userId, userId));
    const unlocked = new Set(owned.map((o) => o.code));
    const blocker = skillBlocker(target, {
      level: progress.level,
      pointsAvailable: progress.skillPointsEarned - progress.skillPointsSpent,
      unlocked,
    });
    if (blocker) {
      const names = new Map((await tx.query.skill.findMany()).map((s) => [s.code, s.name]));
      throw new SkillError(blocker.reason, blockerMessage(blocker, names));
    }

    await tx.insert(playerSkill).values({ userId, skillCode: code, unlockedAt: now });
    await tx
      .update(playerProgress)
      .set({ skillPointsSpent: sql`${playerProgress.skillPointsSpent} + ${target.cost}` })
      .where(eq(playerProgress.userId, userId));

    if (target.effect.type === "daily_template") {
      const template = await tx.query.questTemplate.findFirst({
        where: eq(questTemplate.key, target.effect.templateKey),
        columns: { id: true },
      });
      if (template) {
        await tx.insert(playerQuestSchedule).values({ userId, templateId: template.id }).onConflictDoNothing();
      }
    }

    const achievements = await evaluateAchievements(tx, userId, now);
    return { code, name: target.name, effect: target.effect, achievements };
  });

  // New quests/challenges from the effect appear immediately (both are idempotent).
  if (result.effect.type === "daily_template") await ensureDailyQuests(db, userId, now);
  if (result.effect.type === "weekly_template") await ensureWeeklyChallenges(db, userId, now);
  return { code: result.code, name: result.name, achievements: result.achievements };
}
