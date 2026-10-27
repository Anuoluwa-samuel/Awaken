import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import {
  auditEvent,
  playerAttribute,
  playerProfile,
  playerProgress,
  playerQuestSchedule,
  questTemplate,
} from "@/db/schema";
import { SYSTEM_QUEST_TEMPLATES } from "@/db/seed-data";
import type { AppDb } from "@/db/types";
import { ATTRIBUTES, type Category } from "@/lib/progression/config";
import type { OnboardingInput } from "@/lib/validation/player";
import { ensureDailyQuests } from "./quests";
import { ensureWeeklyChallenges } from "./weekly";

const DEFAULT_STARTERS = ["daily.review-priorities", "daily.study-30", "daily.workout"];
const MAX_STARTERS = 5;

/** Which system templates a new player starts with, from their chosen focus areas. */
export function pickStarterTemplateKeys(focusAreas: Category[], dailyTarget: number | null): string[] {
  const limit = Math.min(dailyTarget ?? MAX_STARTERS, MAX_STARTERS);
  if (focusAreas.length === 0) return DEFAULT_STARTERS.slice(0, Math.max(1, limit));
  const keys = [
    "daily.review-priorities",
    ...SYSTEM_QUEST_TEMPLATES.filter(
      (t) => t.starter && t.cadence === "daily" && focusAreas.includes(t.category),
    ).map((t) => t.key),
  ];
  return [...new Set(keys)].slice(0, Math.max(1, limit));
}

/**
 * Creates the player character: profile, progression row, attributes, starter quest
 * schedule, and today's quests. Idempotent — a second call leaves existing data alone.
 */
export async function createPlayer(db: AppDb, userId: string, input: OnboardingInput, now = new Date()) {
  const created = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(playerProfile)
      .values({
        userId,
        displayName: input.displayName,
        timeZone: input.timeZone,
        dayStartHour: input.dayStartHour,
        focusAreas: input.focusAreas,
        preferredDifficulty: input.preferredDifficulty,
        dailyTarget: input.dailyTarget,
        onboardedAt: now,
      })
      .onConflictDoNothing()
      .returning({ userId: playerProfile.userId });
    if (inserted.length === 0) return false;

    await tx.insert(playerProgress).values({ userId }).onConflictDoNothing();
    await tx
      .insert(playerAttribute)
      .values(ATTRIBUTES.map((attribute) => ({ userId, attribute, points: 0 })))
      .onConflictDoNothing();

    const keys = pickStarterTemplateKeys(input.focusAreas, input.dailyTarget);
    const templates = await tx
      .select({ id: questTemplate.id })
      .from(questTemplate)
      .where(and(inArray(questTemplate.key, keys), isNull(questTemplate.ownerUserId)));
    if (templates.length > 0) {
      await tx
        .insert(playerQuestSchedule)
        .values(templates.map((t) => ({ userId, templateId: t.id })))
        .onConflictDoNothing();
    }
    return true;
  });

  await ensureDailyQuests(db, userId, now);
  await ensureWeeklyChallenges(db, userId, now);
  return { created };
}

export async function getPlayerStatus(db: AppDb, userId: string) {
  const [profile, progress, attributes] = await Promise.all([
    db.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId) }),
    db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) }),
    db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) }),
  ]);
  if (!profile || !progress) return null;
  return { profile, progress, attributes };
}

export const TIMEZONE_CHANGE_COOLDOWN_DAYS = 7;

export type UpdateSettingsResult =
  | { ok: true }
  | { ok: false; error: string; field?: "timeZone" | "dayStartHour" };

/**
 * Updates player settings. Time zone / day-start changes shift the quest day, so they
 * are rate-limited (once per 7 days) to stop players farming extra daily quest sets,
 * and each change is written to the audit log.
 */
export async function updateSettings(
  db: AppDb,
  userId: string,
  input: OnboardingInput,
  now = new Date(),
): Promise<UpdateSettingsResult> {
  return db.transaction(async (tx) => {
    const current = await tx.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId) });
    if (!current) return { ok: false, error: "Player not found" };

    const clockChanged = current.timeZone !== input.timeZone || current.dayStartHour !== input.dayStartHour;
    if (clockChanged) {
      const since = new Date(now.getTime() - TIMEZONE_CHANGE_COOLDOWN_DAYS * 86_400_000);
      const recent = await tx.query.auditEvent.findFirst({
        where: and(
          eq(auditEvent.actorUserId, userId),
          eq(auditEvent.action, "profile.day_boundary_changed"),
          gte(auditEvent.createdAt, since),
        ),
      });
      if (recent) {
        return {
          ok: false,
          field: "timeZone",
          error: `Time zone and day start can be changed once every ${TIMEZONE_CHANGE_COOLDOWN_DAYS} days.`,
        };
      }
      await tx.insert(auditEvent).values({
        actorUserId: userId,
        action: "profile.day_boundary_changed",
        targetType: "player_profile",
        targetId: userId,
        metadata: {
          from: { timeZone: current.timeZone, dayStartHour: current.dayStartHour },
          to: { timeZone: input.timeZone, dayStartHour: input.dayStartHour },
        },
        createdAt: now,
      });
    }

    await tx
      .update(playerProfile)
      .set({
        displayName: input.displayName,
        timeZone: input.timeZone,
        dayStartHour: input.dayStartHour,
        focusAreas: input.focusAreas,
        preferredDifficulty: input.preferredDifficulty,
        dailyTarget: input.dailyTarget,
      })
      .where(eq(playerProfile.userId, userId));
    return { ok: true };
  });
}
