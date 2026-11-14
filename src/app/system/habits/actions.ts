"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { habitIdSchema, habitSchema } from "@/lib/validation/habit";
import { archiveHabit, checkInHabit, createHabit, HabitError, type CheckInResult } from "@/server/services/habits";
import { QuestError } from "@/server/services/quests";
import { guardAction, guardQuota } from "@/server/guards";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof HabitError || err instanceof QuestError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "The System could not process that request. Try again." };
}

export async function checkInHabitAction(habitId: unknown): Promise<Result<CheckInResult>> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = habitIdSchema.safeParse(habitId);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const result = await checkInHabit(db, user.id, parsed.data);
    revalidatePath("/system", "layout");
    return { ok: true, data: result };
  } catch (err) {
    return failure(err);
  }
}

export async function archiveHabitAction(habitId: unknown): Promise<Result> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = habitIdSchema.safeParse(habitId);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    await archiveHabit(db, user.id, parsed.data);
    revalidatePath("/system/habits");
    return { ok: true, data: undefined };
  } catch (err) {
    return failure(err);
  }
}

export async function createHabitAction(input: unknown): Promise<Result> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some fields are invalid." };
  const overQuota = await guardQuota(user.id, "habits_created");
  if (overQuota) return { ok: false, error: overQuota };
  try {
    await createHabit(db, user.id, parsed.data);
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/system/habits");
  redirect("/system/habits?created=1");
}
