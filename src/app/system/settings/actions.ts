"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { settingsSchema } from "@/lib/validation/player";
import { updateSettings, type UpdateSettingsResult } from "@/server/services/player";
import { guardAction, guardQuota } from "@/server/guards";
import { pushConfigured } from "@/server/push-sender";
import { deletePushSubscription, savePushSubscription } from "@/server/services/push";

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

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Turns on the evening reminder for this browser. */
export async function enablePushAction(subscription: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  if (!pushConfigured()) return { ok: false, error: "Reminders aren't set up on this site yet." };
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "This browser's push details weren't valid." };
  await savePushSubscription(db, user.id, parsed.data);
  return { ok: true };
}

/** Turns the reminder off for this browser. */
export async function disablePushAction(endpoint: unknown): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = z.string().url().max(1000).safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  await deletePushSubscription(db, user.id, parsed.data);
  return { ok: true };
}
