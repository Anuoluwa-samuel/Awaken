import { z } from "zod";
import { CATEGORIES, DIFFICULTIES } from "@/lib/progression/config";
import { isValidTimeZone } from "@/lib/time";

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(2, "At least 2 characters").max(32, "At most 32 characters"),
  timeZone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  dayStartHour: z.coerce.number().int().min(0).max(23),
  focusAreas: z.array(z.enum(CATEGORIES)).max(CATEGORIES.length),
  preferredDifficulty: z.enum(DIFFICULTIES),
  dailyTarget: z.coerce.number().int().min(1).max(20).nullable(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const settingsSchema = onboardingSchema.extend({ showOnLeaderboard: z.boolean().optional() });
export type SettingsInput = z.infer<typeof settingsSchema>;
