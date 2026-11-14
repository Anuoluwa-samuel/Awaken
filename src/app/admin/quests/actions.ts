"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { poolQuestSchema } from "@/lib/validation/quest";
import { guardAction } from "@/server/guards";
import { createPoolQuest, PoolError, setPoolQuestActive, updatePoolQuest } from "@/server/services/quest-pool";

export type PoolActionResult = { ok: true } | { ok: false; error: string };

async function run<T>(schema: z.ZodType<T>, input: unknown, fn: (adminId: string, data: T) => Promise<unknown>): Promise<PoolActionResult> {
  const admin = await requireAdmin();
  const limited = await guardAction(admin.id);
  if (limited) return { ok: false, error: limited };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some fields are invalid." };
  try {
    await fn(admin.id, parsed.data);
    revalidatePath("/admin/quests");
    return { ok: true };
  } catch (err) {
    if (err instanceof PoolError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "That change couldn't be saved. Try again." };
  }
}

export async function createPoolQuestAction(input: unknown) {
  return run(poolQuestSchema, input, (adminId, data) => createPoolQuest(db, adminId, data));
}

export async function updatePoolQuestAction(input: unknown) {
  return run(poolQuestSchema.extend({ id: z.string().uuid() }), input, (adminId, { id, ...data }) =>
    updatePoolQuest(db, adminId, id, data),
  );
}

export async function setPoolQuestActiveAction(input: unknown) {
  return run(z.object({ id: z.string().uuid(), active: z.boolean() }), input, (adminId, data) =>
    setPoolQuestActive(db, adminId, data.id, data.active),
  );
}
