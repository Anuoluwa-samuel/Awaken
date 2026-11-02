"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import type { UnlockedAchievement } from "@/server/services/achievements";
import { SkillError, unlockSkill } from "@/server/services/skills";
import { guardAction } from "@/server/guards";

export async function unlockSkillAction(
  code: unknown,
): Promise<{ ok: true; data: { name: string; achievements: UnlockedAchievement[] } } | { ok: false; error: string }> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = z.string().regex(/^[a-z-]{2,40}$/).safeParse(code);
  if (!parsed.success) return { ok: false, error: "Invalid skill." };
  try {
    const r = await unlockSkill(db, user.id, parsed.data);
    revalidatePath("/system", "layout");
    return { ok: true, data: { name: r.name, achievements: r.achievements } };
  } catch (err) {
    if (err instanceof SkillError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "The System could not process that request." };
  }
}
