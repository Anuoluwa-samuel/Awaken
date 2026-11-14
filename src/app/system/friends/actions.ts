"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requirePlayer } from "@/lib/auth/session";
import { guardAction, guardQuota } from "@/server/guards";
import {
  addFriendByCode,
  answerFriendRequest,
  answerQuestVerification,
  cheerLevelUp,
  FriendError,
  removeFriendship,
  requestQuestVerification,
} from "@/server/services/friends";

export type FriendActionResult = { ok: true; message?: string } | { ok: false; error: string };

const id = z.string().uuid();

async function run<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fn: (userId: string, data: T) => Promise<string | void>,
): Promise<FriendActionResult> {
  const { user } = await requirePlayer();
  const limited = await guardAction(user.id);
  if (limited) return { ok: false, error: limited };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const message = await fn(user.id, parsed.data);
    revalidatePath("/system", "layout");
    return { ok: true, message: message || undefined };
  } catch (err) {
    if (err instanceof FriendError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "The System could not process that request. Try again." };
  }
}

export async function addFriendAction(code: unknown) {
  return run(z.string().trim().min(1).max(20), code, async (userId, value) => {
    const overQuota = await guardQuota(userId, "friend_requests");
    if (overQuota) throw new FriendError("LIMIT", overQuota);
    const result = await addFriendByCode(db, userId, value);
    return result.status === "accepted" ? `You and ${result.name} are now friends.` : `Request sent to ${result.name}.`;
  });
}

export async function answerFriendRequestAction(input: unknown) {
  return run(z.object({ id, accept: z.boolean() }), input, async (userId, { id: requestId, accept }) => {
    await answerFriendRequest(db, userId, requestId, accept);
  });
}

export async function removeFriendAction(friendshipId: unknown) {
  return run(id, friendshipId, async (userId, value) => {
    await removeFriendship(db, userId, value);
  });
}

export async function cheerAction(levelEventId: unknown) {
  return run(id, levelEventId, async (userId, value) => {
    await cheerLevelUp(db, userId, value);
  });
}

export async function requestVerificationAction(input: unknown) {
  return run(z.object({ questId: id, friendId: z.string().min(1).max(100) }), input, async (userId, data) => {
    await requestQuestVerification(db, userId, data.questId, data.friendId);
    return "Request sent. You'll be notified when they answer.";
  });
}

export async function answerVerificationAction(input: unknown) {
  return run(z.object({ id, confirm: z.boolean() }), input, async (userId, data) => {
    await answerQuestVerification(db, userId, data.id, data.confirm);
  });
}
