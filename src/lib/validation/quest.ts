import { z } from "zod";
import { ATTRIBUTES, CATEGORIES, DIFFICULTIES, QUEST_LIMITS } from "@/lib/progression/config";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const questIdSchema = z.string().uuid();

export const customQuestSchema = z
  .object({
    title: z.string().trim().min(3, "At least 3 characters").max(QUEST_LIMITS.maxTitleLength),
    description: z.string().trim().max(QUEST_LIMITS.maxDescriptionLength),
    category: z.enum(CATEGORIES),
    difficulty: z.enum(DIFFICULTIES),
    /** null = derived from the category. */
    attribute: z.enum(ATTRIBUTES).nullable(),
    /** null = difficulty default. Clamped on the server, never trusted. */
    xpReward: z.number().int().nullable(),
    scheduleType: z.enum(["once", "recurring"]),
    /** once: optional deadline (the player's local date). */
    targetDate: isoDate.nullable(),
    /** recurring: 0 = Sunday … 6 = Saturday. */
    days: z.array(z.number().int().min(0).max(6)).max(7),
    estimatedMinutes: z.number().int().min(1).max(600).nullable(),
    checklist: z.array(z.string().trim().min(1).max(100)).max(QUEST_LIMITS.maxChecklistItems),
  })
  .refine((v) => v.scheduleType === "once" || v.days.length > 0, {
    path: ["days"],
    message: "Pick at least one day",
  });
export type CustomQuestInput = z.infer<typeof customQuestSchema>;

export const completeQuestSchema = z.object({
  questId: questIdSchema,
  evidenceNote: z.string().trim().max(QUEST_LIMITS.maxEvidenceLength).optional(),
});

/** A daily quest an admin adds to the shared rotation pool. */
export const poolQuestSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(QUEST_LIMITS.maxTitleLength),
  description: z.string().trim().max(QUEST_LIMITS.maxDescriptionLength),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  estimatedMinutes: z.number().int().min(1).max(240).nullable(),
});
export type PoolQuestInput = z.infer<typeof poolQuestSchema>;
