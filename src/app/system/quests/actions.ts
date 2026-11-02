"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { completeQuestSchema, customQuestSchema, questIdSchema } from "@/lib/validation/quest";
import {
  cancelQuest,
  completeQuest,
  createCustomQuest,
  QuestError,
  startQuest,
  type CompletionResult,
} from "@/server/services/quests";
import { guardAction, guardQuota } from "@/server/guards";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof QuestError) return { ok: false, error: err.message };
  // Never leak internals to the client.
  console.error(err);
  return { ok: false, error: "The System could not process that request. Try again." };
}

export async function completeQuestAction(input: unknown): Promise<ActionResult<CompletionResult>> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = completeQuestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const result = await completeQuest(db, user.id, parsed.data.questId, {
      evidenceNote: parsed.data.evidenceNote,
    });
    revalidatePath("/system", "layout");
    return { ok: true, data: result };
  } catch (err) {
    return failure(err);
  }
}

export async function startQuestAction(questId: unknown): Promise<ActionResult> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = questIdSchema.safeParse(questId);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    await startQuest(db, user.id, parsed.data);
    revalidatePath("/system", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return failure(err);
  }
}

export async function cancelQuestAction(questId: unknown): Promise<ActionResult> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = questIdSchema.safeParse(questId);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    await cancelQuest(db, user.id, parsed.data);
    revalidatePath("/system", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return failure(err);
  }
}

export async function createCustomQuestAction(input: unknown): Promise<ActionResult> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = customQuestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some fields are invalid." };
  const overQuota = await guardQuota(user.id, "quests_created");
  if (overQuota) return { ok: false, error: overQuota };
  try {
    await createCustomQuest(db, user.id, parsed.data);
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/system", "layout");
  redirect("/system/quests?created=1");
}
