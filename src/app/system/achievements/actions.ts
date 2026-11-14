"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { AchievementError, equipTitle } from "@/server/services/achievements";
import { guardAction } from "@/server/guards";

const titleSchema = z.string().trim().min(1).max(60).nullable();

export async function equipTitleAction(title: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = titleSchema.safeParse(title);
  if (!parsed.success) return { ok: false, error: "Invalid title." };
  try {
    await equipTitle(db, user.id, parsed.data);
  } catch (err) {
    if (err instanceof AchievementError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "The System could not process that request." };
  }
  revalidatePath("/system", "layout");
  return { ok: true };
}
