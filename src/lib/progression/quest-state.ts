// Quest state machine — docs/ARCHITECTURE.md §6.
//
//            start            complete
// available ───────► in_progress ────────► completed   (terminal)
//     │  └──────────── complete ─────────────┘
//     │ cancel / day rollover
//     └──────────► cancelled | expired                 (terminal, no XP)

export const QUEST_STATUSES = ["available", "in_progress", "completed", "expired", "cancelled"] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];
export type QuestAction = "start" | "complete" | "cancel" | "expire";

const TRANSITIONS: Record<QuestAction, { from: readonly QuestStatus[]; to: QuestStatus }> = {
  start: { from: ["available"], to: "in_progress" },
  complete: { from: ["available", "in_progress"], to: "completed" },
  cancel: { from: ["available", "in_progress"], to: "cancelled" },
  expire: { from: ["available", "in_progress"], to: "expired" },
};

export const OPEN_STATUSES = ["available", "in_progress"] as const satisfies readonly QuestStatus[];

export function isTerminal(status: QuestStatus): boolean {
  return status === "completed" || status === "expired" || status === "cancelled";
}

export function canTransition(status: QuestStatus, action: QuestAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

/** The resulting status, or null when the action is not allowed from `status`. */
export function transition(status: QuestStatus, action: QuestAction): QuestStatus | null {
  return canTransition(status, action) ? TRANSITIONS[action].to : null;
}
