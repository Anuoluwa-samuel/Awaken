import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { focusSession, playerProfile, playerProgress, playerQuest, playerSkill } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { Attribute } from "@/lib/progression/config";
import {
  breakAfter,
  checkFocusMinutes,
  creditedSeconds,
  focusXp,
  isFullSession,
} from "@/lib/progression/focus";
import { applyXp, type ProgressionChange } from "@/lib/progression/rewards";
import { addDays, questDay, type QuestDate } from "@/lib/time";
import { evaluateAchievements, type UnlockedAchievement } from "./achievements";
import { completeQuest, type CompletionResult } from "./quests";
import { grantAttribute, grantXp, lockProgress } from "./rewards";

// Focus sessions — docs/ARCHITECTURE.md §6e.
// The server owns the clock: it stores start/pause timestamps and decides whether a session
// is full. The client only displays a countdown derived from those timestamps, so a refresh
// recovers the session and a modified request can't claim extra focus time.

export class FocusError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "INVALID_STATE" | "INVALID_DURATION" | "NOT_FINISHED" | "QUEST_NOT_ELIGIBLE" | "PLAYER_NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export type FocusSession = typeof focusSession.$inferSelect;

async function playerToday(tx: AppDb, userId: string, now: Date): Promise<QuestDate> {
  const profile = await tx.query.playerProfile.findFirst({
    where: eq(playerProfile.userId, userId),
    columns: { timeZone: true, dayStartHour: true },
  });
  if (!profile) throw new FocusError("PLAYER_NOT_FOUND", "Player profile not found");
  return questDay(now, profile.timeZone, profile.dayStartHour);
}

async function hasDeepFocus(db: AppDb, userId: string) {
  const row = await db.query.playerSkill.findFirst({
    where: and(eq(playerSkill.userId, userId), eq(playerSkill.skillCode, "deep-focus")),
  });
  return !!row;
}

async function lockOwnedSession(tx: AppDb, userId: string, sessionId: string) {
  const [s] = await tx
    .select()
    .from(focusSession)
    .where(and(eq(focusSession.id, sessionId), eq(focusSession.userId, userId)))
    .for("update");
  if (!s) throw new FocusError("NOT_FOUND", "Focus session not found");
  return s;
}

export async function getActiveFocus(db: AppDb, userId: string) {
  const session = await db.query.focusSession.findFirst({
    where: and(eq(focusSession.userId, userId), inArray(focusSession.status, ["running", "paused"])),
  });
  if (!session) return null;
  const quest = session.playerQuestId
    ? await db.query.playerQuest.findFirst({
        where: and(eq(playerQuest.id, session.playerQuestId), eq(playerQuest.userId, userId)),
        columns: { id: true, title: true },
      })
    : null;
  return { session, quest: quest ?? null };
}

/** Starts a session. If one is already active (double click, second tab) it is returned instead. */
export async function startFocus(
  db: AppDb,
  userId: string,
  input: { minutes: number; questId?: string | null },
  now = new Date(),
): Promise<{ session: FocusSession; resumedExisting: boolean }> {
  return db.transaction(async (tx) => {
    const check = checkFocusMinutes(input.minutes, await hasDeepFocus(tx, userId));
    if (!check.ok) throw new FocusError("INVALID_DURATION", check.reason);
    const today = await playerToday(tx, userId, now);

    if (input.questId) {
      const quest = await tx.query.playerQuest.findFirst({
        where: and(
          eq(playerQuest.id, input.questId),
          eq(playerQuest.userId, userId),
          inArray(playerQuest.status, ["available", "in_progress"]),
        ),
        columns: { id: true },
      });
      if (!quest) throw new FocusError("QUEST_NOT_ELIGIBLE", "That quest isn't open.");
    }

    // The partial unique index allows one active session per player; a conflict means one exists.
    const [created] = await tx
      .insert(focusSession)
      .values({
        userId,
        playerQuestId: input.questId ?? null,
        plannedSeconds: input.minutes * 60,
        startedAt: now,
        startDate: today,
        status: "running",
      })
      .onConflictDoNothing()
      .returning();
    if (created) return { session: created, resumedExisting: false };

    const existing = await tx.query.focusSession.findFirst({
      where: and(eq(focusSession.userId, userId), inArray(focusSession.status, ["running", "paused"])),
    });
    if (!existing) throw new FocusError("INVALID_STATE", "Could not start a focus session.");
    return { session: existing, resumedExisting: true };
  });
}

export async function pauseFocus(db: AppDb, userId: string, sessionId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const s = await lockOwnedSession(tx, userId, sessionId);
    if (s.status === "paused") return s;
    if (s.status !== "running") throw new FocusError("INVALID_STATE", "This session has ended.");
    const [updated] = await tx
      .update(focusSession)
      .set({ status: "paused", pausedAt: now })
      .where(eq(focusSession.id, s.id))
      .returning();
    return updated;
  });
}

export async function resumeFocus(db: AppDb, userId: string, sessionId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const s = await lockOwnedSession(tx, userId, sessionId);
    if (s.status === "running") return s;
    if (s.status !== "paused" || !s.pausedAt) throw new FocusError("INVALID_STATE", "This session has ended.");
    const pausedFor = Math.max(0, Math.floor((now.getTime() - s.pausedAt.getTime()) / 1000));
    const [updated] = await tx
      .update(focusSession)
      .set({ status: "running", pausedAt: null, totalPausedSeconds: s.totalPausedSeconds + pausedFor })
      .where(eq(focusSession.id, s.id))
      .returning();
    return updated;
  });
}

/** Ends a session before its planned length. The focused minutes are recorded; no XP. */
export async function endFocusEarly(db: AppDb, userId: string, sessionId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const s = await lockOwnedSession(tx, userId, sessionId);
    if (s.status === "completed" || s.status === "abandoned") return s;
    const [updated] = await tx
      .update(focusSession)
      .set({ status: "abandoned", endedAt: now, creditedSeconds: creditedSeconds(s, now) })
      .where(eq(focusSession.id, s.id))
      .returning();
    return updated;
  });
}

export type FocusCompletion =
  | { status: "already_ended"; session: FocusSession }
  | {
      status: "completed";
      session: FocusSession;
      /** "quest": the linked quest was completed and only its rewards applied. */
      via: "focus" | "quest";
      xp: { granted: number; note: string | null };
      attributes: { attribute: Attribute; granted: number }[];
      levelChange: ProgressionChange | null;
      achievements: UnlockedAchievement[];
      quest: CompletionResult | null;
      suggestedBreak: { kind: "short" | "long"; minutes: number };
      linkedQuestNote: string | null;
    };

/**
 * Completes a full session exactly once. The server checks the focused time itself;
 * an early or repeated request can't earn XP.
 */
export async function completeFocus(db: AppDb, userId: string, sessionId: string, now = new Date()): Promise<FocusCompletion> {
  return db.transaction(async (tx) => {
    // Lock order: focus row → (quest row) → player row.
    const s = await lockOwnedSession(tx, userId, sessionId);
    if (s.status === "completed" || s.status === "abandoned") return { status: "already_ended", session: s };
    if (!isFullSession(s, now)) throw new FocusError("NOT_FINISHED", "This session isn't finished yet.");

    const [session] = await tx
      .update(focusSession)
      .set({ status: "completed", endedAt: now, pausedAt: null, creditedSeconds: s.plannedSeconds })
      .where(eq(focusSession.id, s.id))
      .returning();
    const today = await playerToday(tx, userId, now);
    const minutes = s.plannedSeconds / 60;

    // A linked quest is completed by the session if it is still open and the session covered
    // its estimate; then only the quest's rewards apply (never both).
    let quest: CompletionResult | null = null;
    let linkedQuestNote: string | null = null;
    if (s.playerQuestId) {
      const linked = await tx.query.playerQuest.findFirst({
        where: and(eq(playerQuest.id, s.playerQuestId), eq(playerQuest.userId, userId)),
      });
      const open = linked && (linked.status === "available" || linked.status === "in_progress");
      const covers = linked && (linked.estimatedMinutes == null || minutes >= linked.estimatedMinutes);
      if (open && covers) {
        try {
          quest = await completeQuest(tx, userId, linked.id, { method: "focus_session", now });
        } catch {
          linkedQuestNote = "The linked quest can't be completed today, so the focus reward applies instead.";
        }
      } else if (open && !covers) {
        linkedQuestNote = `The linked quest needs ${linked.estimatedMinutes} minutes — complete it from the quest log when you're done.`;
      }
    }

    const completedToday = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(focusSession)
      .where(and(eq(focusSession.userId, userId), eq(focusSession.status, "completed"), eq(focusSession.startDate, today)));
    const suggestedBreak = breakAfter(completedToday[0].n);

    if (quest) {
      return {
        status: "completed",
        session,
        via: "quest",
        xp: { granted: quest.xp.granted, note: quest.xp.note },
        attributes: quest.attributes,
        levelChange: quest.levelChange,
        achievements: quest.achievements,
        quest,
        suggestedBreak,
        linkedQuestNote,
      };
    }

    const before = await lockProgress(tx, userId);
    const xp = await grantXp(tx, {
      userId,
      eventType: "focus_completed",
      sourceType: "focus_session",
      sourceId: s.id,
      amount: focusXp(s.plannedSeconds),
      reason: `Focus session: ${minutes} min`,
      idempotencyKey: `focus:${s.id}`,
      now,
    });
    const attr = await grantAttribute(tx, {
      userId,
      attribute: "discipline",
      amount: 1,
      sourceType: "focus_session",
      sourceId: s.id,
      idempotencyKey: `focus:${s.id}:attr`,
      now,
    });
    const achievements = await evaluateAchievements(tx, userId, now);
    const after = await tx.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) });
    const change = applyXp(before.totalXp, (after?.totalXp ?? before.totalXp) - before.totalXp);

    return {
      status: "completed",
      session,
      via: "focus",
      xp: xp.status === "granted" ? { granted: xp.granted, note: xp.capReason } : { granted: 0, note: "Already rewarded." },
      attributes: attr.status === "granted" ? [{ attribute: "discipline", granted: attr.granted }] : [],
      levelChange: change.levelsGained > 0 ? change : null,
      achievements,
      quest: null,
      suggestedBreak,
      linkedQuestNote,
    };
  });
}

/** Today's and this week's focus totals plus recent sessions, from persisted records. */
export async function getFocusSummary(db: AppDb, userId: string, today: QuestDate) {
  const [recent, totals] = await Promise.all([
    db.query.focusSession.findMany({
      where: and(eq(focusSession.userId, userId), inArray(focusSession.status, ["completed", "abandoned"])),
      orderBy: [desc(focusSession.startedAt)],
      limit: 15,
    }),
    db
      .select({
        todaySeconds: sql<number>`coalesce(sum(${focusSession.creditedSeconds}) filter (where ${focusSession.startDate} = ${today}), 0)::int`,
        weekSeconds: sql<number>`coalesce(sum(${focusSession.creditedSeconds}), 0)::int`,
        completedToday: sql<number>`count(*) filter (where ${focusSession.startDate} = ${today} and ${focusSession.status} = 'completed')::int`,
      })
      .from(focusSession)
      .where(and(eq(focusSession.userId, userId), gte(focusSession.startDate, addDays(today, -6)))),
  ]);
  const questIds = [...new Set(recent.flatMap((r) => (r.playerQuestId ? [r.playerQuestId] : [])))];
  const quests = questIds.length
    ? await db
        .select({ id: playerQuest.id, title: playerQuest.title })
        .from(playerQuest)
        .where(and(eq(playerQuest.userId, userId), inArray(playerQuest.id, questIds)))
    : [];
  const titles = new Map(quests.map((q) => [q.id, q.title]));
  return {
    ...totals[0],
    recent: recent.map((r) => ({ ...r, questTitle: r.playerQuestId ? (titles.get(r.playerQuestId) ?? null) : null })),
  };
}

export { hasDeepFocus };
