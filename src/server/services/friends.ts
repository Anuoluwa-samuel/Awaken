import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  cheer,
  friendship,
  levelEvent,
  playerProfile,
  playerProgress,
  playerQuest,
  questCompletion,
  questVerification,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { verifiedBonus } from "@/lib/progression/bonuses";
import { evaluateAchievements } from "./achievements";
import { consumeDaily } from "./limits";
import { notify } from "./notifications";
import { grantXp } from "./rewards";

// Friends, by invitation only: a player shares their friend code, the other enters it, and the first
// accepts. Friends see each other's name, level, rank, title and level-ups. There is no chat: the only
// interactions are a one-tap cheer and confirming each other's quests, so there's nothing to harass with.

export const FRIEND_RULES = {
  maxFriends: 50,
  maxPendingSent: 20,
  /** Level-ups shown for cheering. */
  feedDays: 14,
  /** How long after completing a quest a friend can be asked to confirm it. */
  verifyWindowHours: 48,
  verifyRequestsPerDay: 5,
} as const;

export class FriendError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "SELF" | "ALREADY" | "LIMIT" | "NOT_FRIENDS" | "INVALID",
    message: string,
  ) {
    super(message);
  }
}

/** Codes are shown in groups and typed loosely: ignore case, spaces and dashes. */
export const normaliseFriendCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");

const pairOf = (a: string, b: string) =>
  or(
    and(eq(friendship.requesterId, a), eq(friendship.addresseeId, b)),
    and(eq(friendship.requesterId, b), eq(friendship.addresseeId, a)),
  );

/** Ids of the player's accepted friends. */
export async function friendIds(db: AppDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendship.requesterId, addresseeId: friendship.addresseeId })
    .from(friendship)
    .where(
      and(eq(friendship.status, "accepted"), or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId))),
    );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export async function areFriends(db: AppDb, a: string, b: string) {
  const [row] = await db
    .select({ id: friendship.id })
    .from(friendship)
    .where(and(pairOf(a, b), eq(friendship.status, "accepted")))
    .limit(1);
  return !!row;
}

async function displayName(db: AppDb, userId: string) {
  const p = await db.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { displayName: true },
  });
  return p?.displayName ?? "A friend";
}

/**
 * Sends a friend request to the player with this code. If they had already asked us, this accepts it
 * instead, so two people adding each other at once end up friends.
 */
export async function addFriendByCode(db: AppDb, userId: string, rawCode: string, now = new Date()) {
  const code = normaliseFriendCode(rawCode);
  if (!/^[A-Z0-9]{8}$/.test(code)) throw new FriendError("INVALID", "Friend codes are 8 letters and numbers.");
  return db.transaction(async (tx) => {
    const target = await tx.query.playerProfile.findFirst({
      where: eq(playerProfile.friendCode, code),
      columns: { userId: true, displayName: true },
    });
    if (!target) throw new FriendError("NOT_FOUND", "No player has that friend code.");
    if (target.userId === userId) throw new FriendError("SELF", "That's your own friend code.");

    const [existing] = await tx.select().from(friendship).where(pairOf(userId, target.userId)).for("update");
    if (existing?.status === "accepted") throw new FriendError("ALREADY", `You and ${target.displayName} are already friends.`);
    if (existing && existing.requesterId === userId) {
      throw new FriendError("ALREADY", `You've already sent ${target.displayName} a request.`);
    }
    if (existing) return acceptRow(tx, existing.id, userId, now);

    const mine = await friendIds(tx, userId);
    if (mine.length >= FRIEND_RULES.maxFriends) {
      throw new FriendError("LIMIT", `You can have up to ${FRIEND_RULES.maxFriends} friends.`);
    }
    const [{ pending }] = await tx
      .select({ pending: sql<number>`count(*)::int` })
      .from(friendship)
      .where(and(eq(friendship.requesterId, userId), eq(friendship.status, "pending")));
    if (pending >= FRIEND_RULES.maxPendingSent) {
      throw new FriendError("LIMIT", `You have ${pending} requests waiting. Wait for some to be answered first.`);
    }

    const [row] = await tx
      .insert(friendship)
      .values({ requesterId: userId, addresseeId: target.userId, createdAt: now })
      .onConflictDoNothing()
      .returning({ id: friendship.id });
    if (!row) throw new FriendError("ALREADY", `You've already sent ${target.displayName} a request.`);
    await notify(tx, {
      userId: target.userId,
      type: "system",
      title: "Friend request",
      body: `${await displayName(tx, userId)} wants to add you as a friend.`,
      href: "/system/friends",
      dedupeKey: `friend-request:${row.id}`,
      createdAt: now,
    });
    return { status: "requested" as const, name: target.displayName };
  });
}

async function acceptRow(tx: AppDb, id: string, userId: string, now: Date) {
  const [row] = await tx
    .update(friendship)
    .set({ status: "accepted", acceptedAt: now })
    .where(and(eq(friendship.id, id), eq(friendship.addresseeId, userId), eq(friendship.status, "pending")))
    .returning();
  if (!row) throw new FriendError("NOT_FOUND", "That request no longer exists.");
  await notify(tx, {
    userId: row.requesterId,
    type: "system",
    title: "Friend added",
    body: `${await displayName(tx, userId)} accepted your friend request.`,
    href: "/system/friends",
    dedupeKey: `friend-accepted:${row.id}`,
    createdAt: now,
  });
  // Friend achievements for both players.
  await evaluateAchievements(tx, userId, now);
  await evaluateAchievements(tx, row.requesterId, now);
  return { status: "accepted" as const, name: await displayName(tx, row.requesterId) };
}

/** Accepts or declines a request sent to this player. Declining deletes it quietly. */
export async function answerFriendRequest(db: AppDb, userId: string, requestId: string, accept: boolean, now = new Date()) {
  return db.transaction(async (tx) => {
    if (accept) return acceptRow(tx, requestId, userId, now);
    const rows = await tx
      .delete(friendship)
      .where(and(eq(friendship.id, requestId), eq(friendship.addresseeId, userId), eq(friendship.status, "pending")))
      .returning({ id: friendship.id });
    if (rows.length === 0) throw new FriendError("NOT_FOUND", "That request no longer exists.");
    return { status: "declined" as const };
  });
}

/** Cancels a sent request or removes a friend. Either side may do it. */
export async function removeFriendship(db: AppDb, userId: string, friendshipId: string) {
  const rows = await db
    .delete(friendship)
    .where(
      and(eq(friendship.id, friendshipId), or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId))),
    )
    .returning({ id: friendship.id });
  if (rows.length === 0) throw new FriendError("NOT_FOUND", "That friend is no longer on your list.");
}

/** Everything the Friends page shows. Only what friends may see: never an email. */
export async function getFriendsPage(db: AppDb, userId: string, now = new Date()) {
  const me = await db.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { friendCode: true },
  });
  const rows = await db
    .select()
    .from(friendship)
    .where(or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId)));
  const otherOf = (r: (typeof rows)[number]) => (r.requesterId === userId ? r.addresseeId : r.requesterId);
  const others = rows.map(otherOf);
  const people = others.length
    ? await db
        .select({
          userId: playerProfile.userId,
          displayName: playerProfile.displayName,
          title: playerProfile.equippedTitle,
          level: playerProgress.level,
          rank: playerProgress.rank,
          totalXp: playerProgress.totalXp,
        })
        .from(playerProfile)
        .innerJoin(playerProgress, eq(playerProgress.userId, playerProfile.userId))
        .where(inArray(playerProfile.userId, others))
    : [];
  const byId = new Map(people.map((p) => [p.userId, p]));
  const withPerson = (r: (typeof rows)[number]) => ({ id: r.id, since: r.acceptedAt ?? r.createdAt, person: byId.get(otherOf(r))! });

  const friends = rows.filter((r) => r.status === "accepted" && byId.has(otherOf(r))).map(withPerson);
  const incoming = rows.filter((r) => r.status === "pending" && r.addresseeId === userId && byId.has(otherOf(r))).map(withPerson);
  const outgoing = rows.filter((r) => r.status === "pending" && r.requesterId === userId && byId.has(otherOf(r))).map(withPerson);

  const ids = friends.map((f) => f.person.userId);
  const since = new Date(now.getTime() - FRIEND_RULES.feedDays * 86_400_000);
  const levelUps = ids.length
    ? await db
        .select({
          id: levelEvent.id,
          userId: levelEvent.userId,
          toLevel: levelEvent.toLevel,
          fromRank: levelEvent.fromRank,
          toRank: levelEvent.toRank,
          at: levelEvent.createdAt,
          // Written out in full: Drizzle drops table names in a single-table select.
          cheers: sql<number>`(select count(*)::int from "cheer" where "cheer"."level_event_id" = "level_event"."id")`,
          cheered: sql<boolean>`exists (select 1 from "cheer" where "cheer"."level_event_id" = "level_event"."id" and "cheer"."from_user_id" = ${userId})`,
        })
        .from(levelEvent)
        .where(and(inArray(levelEvent.userId, ids), gte(levelEvent.createdAt, since)))
        .orderBy(desc(levelEvent.createdAt))
        .limit(30)
    : [];

  const verifications = await db
    .select({
      id: questVerification.id,
      questTitle: playerQuest.title,
      difficulty: playerQuest.difficulty,
      requesterId: questVerification.requesterId,
      requesterName: playerProfile.displayName,
      note: questCompletion.evidenceNote,
      completedAt: questCompletion.completedAt,
      requestedAt: questVerification.createdAt,
    })
    .from(questVerification)
    .innerJoin(playerQuest, eq(playerQuest.id, questVerification.playerQuestId))
    .innerJoin(questCompletion, eq(questCompletion.playerQuestId, questVerification.playerQuestId))
    .innerJoin(playerProfile, eq(playerProfile.userId, questVerification.requesterId))
    .where(and(eq(questVerification.verifierId, userId), eq(questVerification.status, "pending")))
    .orderBy(desc(questVerification.createdAt));

  return {
    friendCode: me?.friendCode ?? "",
    friends: friends.sort((a, b) => b.person.totalXp - a.person.totalXp),
    incoming,
    outgoing,
    levelUps: levelUps.map((l) => ({ ...l, name: byId.get(l.userId)?.displayName ?? "A friend" })),
    verifications,
  };
}

/** A one-tap cheer on a friend's level-up. Repeats are ignored. */
export async function cheerLevelUp(db: AppDb, userId: string, levelEventId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const event = await tx.query.levelEvent.findFirst({ where: eq(levelEvent.id, levelEventId) });
    if (!event || event.userId === userId || !(await areFriends(tx, userId, event.userId))) {
      throw new FriendError("NOT_FOUND", "You can only cheer your friends' level-ups.");
    }
    const [row] = await tx
      .insert(cheer)
      .values({ fromUserId: userId, toUserId: event.userId, levelEventId, createdAt: now })
      .onConflictDoNothing()
      .returning({ id: cheer.id });
    if (!row) return { status: "already" as const };
    await notify(tx, {
      userId: event.userId,
      type: "system",
      title: "⚡ Cheer",
      body: `${await displayName(tx, userId)} cheered your level ${event.toLevel}.`,
      href: "/system/friends",
      dedupeKey: `cheer:${row.id}`,
      createdAt: now,
    });
    await evaluateAchievements(tx, userId, now);
    return { status: "cheered" as const };
  });
}

// ─── Friend confirmation ─────────────────────────────────────────────────────

/** Whether a quest can still be sent for confirmation, and its current state. */
export async function getQuestVerification(db: AppDb, userId: string, questId: string) {
  const row = await db.query.questVerification.findFirst({
    where: and(eq(questVerification.playerQuestId, questId), eq(questVerification.requesterId, userId)),
  });
  if (!row) return null;
  return { status: row.status, verifierName: await displayName(db, row.verifierId), decidedAt: row.decidedAt };
}

/** Asks a friend to confirm a completed quest. One request per quest, a few per day. */
export async function requestQuestVerification(db: AppDb, userId: string, questId: string, friendId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [quest] = await tx
      .select({ id: playerQuest.id, title: playerQuest.title, status: playerQuest.status, completedAt: questCompletion.completedAt })
      .from(playerQuest)
      .innerJoin(questCompletion, eq(questCompletion.playerQuestId, playerQuest.id))
      .where(and(eq(playerQuest.id, questId), eq(playerQuest.userId, userId)));
    if (!quest || quest.status !== "completed") throw new FriendError("NOT_FOUND", "Only completed quests can be confirmed.");
    if (now.getTime() - quest.completedAt.getTime() > FRIEND_RULES.verifyWindowHours * 3_600_000) {
      throw new FriendError("INVALID", `Ask within ${FRIEND_RULES.verifyWindowHours} hours of completing a quest.`);
    }
    if (!(await areFriends(tx, userId, friendId))) throw new FriendError("NOT_FRIENDS", "You can only ask a friend.");
    if (!(await consumeDaily(tx, userId, "verify_requests", FRIEND_RULES.verifyRequestsPerDay, now))) {
      throw new FriendError("LIMIT", `You can ask for ${FRIEND_RULES.verifyRequestsPerDay} confirmations a day.`);
    }
    const [row] = await tx
      .insert(questVerification)
      .values({ playerQuestId: questId, requesterId: userId, verifierId: friendId, createdAt: now })
      .onConflictDoNothing()
      .returning({ id: questVerification.id });
    if (!row) throw new FriendError("ALREADY", "You've already asked someone to confirm this quest.");
    await notify(tx, {
      userId: friendId,
      type: "system",
      title: "Confirm a quest",
      body: `${await displayName(tx, userId)} asked you to confirm: ${quest.title}.`,
      href: "/system/friends",
      dedupeKey: `verify-request:${row.id}`,
      createdAt: now,
    });
  });
}

/** The friend's answer. A confirmation grants the requester a small bonus, once. */
export async function answerQuestVerification(db: AppDb, userId: string, verificationId: string, confirm: boolean, now = new Date()) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(questVerification)
      .set({ status: confirm ? "confirmed" : "declined", decidedAt: now })
      .where(
        and(
          eq(questVerification.id, verificationId),
          eq(questVerification.verifierId, userId),
          eq(questVerification.status, "pending"),
        ),
      )
      .returning();
    if (!row) throw new FriendError("NOT_FOUND", "That request has already been answered.");
    const quest = await tx.query.playerQuest.findFirst({ where: eq(playerQuest.id, row.playerQuestId) });
    const name = await displayName(tx, userId);
    let xp = 0;
    if (confirm && quest) {
      const grant = await grantXp(tx, {
        userId: row.requesterId,
        eventType: "bonus",
        sourceType: "quest_verification",
        sourceId: row.id,
        amount: verifiedBonus(quest.xpReward),
        reason: `Confirmed by ${name}: ${quest.title}`,
        idempotencyKey: `verified:${row.playerQuestId}`,
        now,
      });
      if (grant.status === "granted") xp = grant.granted;
      await evaluateAchievements(tx, row.requesterId, now);
    }
    await notify(tx, {
      userId: row.requesterId,
      type: "quest",
      title: confirm ? "Quest confirmed" : "Quest not confirmed",
      body: confirm
        ? `${name} confirmed ${quest?.title ?? "your quest"}.${xp ? ` +${xp} XP` : ""}`
        : `${name} couldn't confirm ${quest?.title ?? "your quest"}.`,
      href: quest ? `/system/quests/${quest.id}` : "/system/quests",
      dedupeKey: `verify-answer:${row.id}`,
      createdAt: now,
    });
    return { status: row.status, xp };
  });
}

/** Accepted friends' ids and names, for pickers (e.g. who to ask for a confirmation). */
export async function listFriendNames(db: AppDb, userId: string) {
  const ids = await friendIds(db, userId);
  if (ids.length === 0) return [];
  return db
    .select({ userId: playerProfile.userId, name: playerProfile.displayName })
    .from(playerProfile)
    .where(inArray(playerProfile.userId, ids))
    .orderBy(playerProfile.displayName);
}

/** What a quest's page needs for confirmation: its state, and who could still be asked. */
export async function getVerificationOptions(db: AppDb, userId: string, questId: string, completedAt: Date, now = new Date()) {
  const [verification, friends] = await Promise.all([getQuestVerification(db, userId, questId), listFriendNames(db, userId)]);
  const inWindow = now.getTime() - completedAt.getTime() < FRIEND_RULES.verifyWindowHours * 3_600_000;
  return { verification, friends, canAsk: !verification && inWindow && friends.length > 0 };
}
