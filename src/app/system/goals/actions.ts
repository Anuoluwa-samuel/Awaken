"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { goalIdSchema, goalSchema, milestoneSchema } from "@/lib/validation/goal";
import {
  addMilestone,
  archiveGoal,
  completeMilestone,
  createGoal,
  createQuestForMilestone,
  GoalError,
  type MilestoneResult,
} from "@/server/services/goals";
import { QuestError } from "@/server/services/quests";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const idSchema = z.string().uuid();

async function run<T>(fn: (userId: string) => Promise<T>): Promise<Result<T>> {
  const { user } = await requirePlayer();
  try {
    const data = await fn(user.id);
    revalidatePath("/system", "layout");
    return { ok: true, data };
  } catch (err) {
    if (err instanceof GoalError || err instanceof QuestError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "The System could not process that request." };
  }
}

export async function completeMilestoneAction(id: unknown): Promise<Result<MilestoneResult>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run((userId) => completeMilestone(db, userId, parsed.data));
}

export async function addMilestoneAction(input: unknown): Promise<Result<void>> {
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid milestone." };
  return run(async (userId) => {
    await addMilestone(db, userId, parsed.data.goalId, parsed.data.title);
  });
}

export async function createQuestForMilestoneAction(id: unknown): Promise<Result<{ questId: string }>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run((userId) => createQuestForMilestone(db, userId, parsed.data));
}

export async function archiveGoalAction(id: unknown): Promise<Result<void>> {
  const parsed = goalIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run(async (userId) => {
    await archiveGoal(db, userId, parsed.data);
  });
}

export async function createGoalAction(input: unknown): Promise<Result> {
  const { user } = await requirePlayer();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  try {
    await createGoal(db, user.id, parsed.data);
  } catch (err) {
    if (err instanceof GoalError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "The System could not process that request." };
  }
  revalidatePath("/system/goals");
  redirect("/system/goals?created=1");
}
