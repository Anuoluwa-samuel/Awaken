import { and, eq, isNull } from "drizzle-orm";
import { habit, habitCompletion } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { QuestDate } from "@/lib/time";

/**
 * Called inside quest completion: records today's check-in for any active habit linked to
 * the quest's template. No rewards — the quest already paid them (docs/ARCHITECTURE.md §6c).
 */
export async function recordLinkedHabitCheckIns(
  tx: AppDb,
  userId: string,
  templateId: string,
  today: QuestDate,
  now: Date,
) {
  const linked = await tx
    .select({ id: habit.id })
    .from(habit)
    .where(and(eq(habit.userId, userId), eq(habit.linkedTemplateId, templateId), isNull(habit.archivedAt)));
  if (linked.length === 0) return;
  await tx
    .insert(habitCompletion)
    .values(linked.map((h) => ({ habitId: h.id, userId, localDate: today, completedAt: now })))
    .onConflictDoNothing();
}
