"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { settingsSchema } from "@/lib/validation/player";
import { updateSettings, type UpdateSettingsResult } from "@/server/services/player";
import { guardAction, guardQuota } from "@/server/guards";

export async function saveSettings(input: unknown): Promise<UpdateSettingsResult> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some settings were invalid." };
  const overQuota = await guardQuota(user.id, "settings_saved");
  if (overQuota) return { ok: false, error: overQuota };
  const result = await updateSettings(db, user.id, parsed.data);
  if (result.ok) revalidatePath("/system", "layout");
  return result;
}
