import { z } from "zod";
import { ATTRIBUTES, CATEGORIES, HABIT_RULES } from "@/lib/progression/config";

export const habitIdSchema = z.string().uuid();

export const habitSchema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(HABIT_RULES.maxNameLength),
    description: z.string().trim().max(HABIT_RULES.maxDescriptionLength),
    category: z.enum(CATEGORIES),
    /** null = derived from the category. */
    attribute: z.enum(ATTRIBUTES).nullable(),
    scheduleType: z.enum(["days", "weekly"]),
    /** days: 0 = Sunday … 6 = Saturday. */
    days: z.array(z.number().int().min(0).max(6)).max(7),
    timesPerWeek: z.number().int().min(1).max(7).nullable(),
    /** Optional quest template the habit stands for (one of the player's scheduled dailies). */
    linkedTemplateId: z.string().uuid().nullable(),
  })
  .refine((v) => v.scheduleType !== "days" || v.days.length > 0, {
    path: ["days"],
    message: "Pick at least one day",
  })
  .refine((v) => v.scheduleType !== "weekly" || v.timesPerWeek != null, {
    path: ["timesPerWeek"],
    message: "Choose how many times per week",
  });
export type HabitInput = z.infer<typeof habitSchema>;
