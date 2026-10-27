"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { settingsSchema } from "@/lib/validation/player";
import { updateSettings, type UpdateSettingsResult } from "@/server/services/player";

export async function saveSettings(input: unknown): Promise<UpdateSettingsResult> {
  const { user } = await requirePlayer();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some settings were invalid." };
  const result = await updateSettings(db, user.id, parsed.data);
  if (result.ok) revalidatePath("/system", "layout");
  return result;
}
