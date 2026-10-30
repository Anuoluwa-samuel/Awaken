"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import {
  completeFocus,
  endFocusEarly,
  FocusError,
  pauseFocus,
  resumeFocus,
  startFocus,
  type FocusCompletion,
  type FocusSession,
} from "@/server/services/focus";
import { QuestError } from "@/server/services/quests";

type Result<T> = { ok: true; data: T; serverNow: string } | { ok: false; error: string };

const idSchema = z.string().uuid();
const startSchema = z.object({ minutes: z.number().int(), questId: z.string().uuid().nullable() });

async function run<T>(fn: (userId: string) => Promise<T>, revalidate = false): Promise<Result<T>> {
  const { user } = await requirePlayer();
  try {
    const data = await fn(user.id);
    if (revalidate) revalidatePath("/system", "layout");
    return { ok: true, data, serverNow: new Date().toISOString() };
  } catch (err) {
    if (err instanceof FocusError || err instanceof QuestError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "The System could not process that request." };
  }
}

export async function startFocusAction(input: unknown): Promise<Result<{ session: FocusSession; resumedExisting: boolean }>> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run((userId) => startFocus(db, userId, parsed.data));
}

export async function pauseFocusAction(id: unknown): Promise<Result<FocusSession>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run((userId) => pauseFocus(db, userId, parsed.data));
}

export async function resumeFocusAction(id: unknown): Promise<Result<FocusSession>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run((userId) => resumeFocus(db, userId, parsed.data));
}

export async function endFocusEarlyAction(id: unknown): Promise<Result<FocusSession>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run((userId) => endFocusEarly(db, userId, parsed.data), true);
}

export async function completeFocusAction(id: unknown): Promise<Result<FocusCompletion>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return run((userId) => completeFocus(db, userId, parsed.data), true);
}
