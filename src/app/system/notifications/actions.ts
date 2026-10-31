"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { markAllRead, markRead } from "@/server/services/notifications";

export async function markReadAction(ids: unknown): Promise<{ ok: boolean }> {
  const { user } = await requirePlayer();
  const parsed = z.array(z.string().uuid()).max(100).safeParse(ids);
  if (!parsed.success) return { ok: false };
  await markRead(db, user.id, parsed.data);
  revalidatePath("/system", "layout");
  return { ok: true };
}

export async function markAllReadAction(): Promise<{ ok: boolean }> {
  const { user } = await requirePlayer();
  await markAllRead(db, user.id);
  revalidatePath("/system", "layout");
  return { ok: true };
}
