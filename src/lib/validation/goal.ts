import { z } from "zod";
import { CATEGORIES, GOAL_RULES } from "@/lib/progression/config";

export const goalIdSchema = z.string().uuid();
const milestoneTitle = z.string().trim().min(2, "At least 2 characters").max(GOAL_RULES.maxTitleLength);

export const goalSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(GOAL_RULES.maxTitleLength),
  description: z.string().trim().max(500),
  category: z.enum(CATEGORIES),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  milestones: z
    .array(milestoneTitle)
    .min(1, "Add at least one milestone")
    .max(GOAL_RULES.maxMilestones, `At most ${GOAL_RULES.maxMilestones} milestones`),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const milestoneSchema = z.object({ goalId: goalIdSchema, title: milestoneTitle });
