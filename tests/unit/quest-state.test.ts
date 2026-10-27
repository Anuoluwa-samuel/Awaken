import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, QUEST_STATUSES, transition } from "@/lib/progression/quest-state";

describe("quest state machine", () => {
  it("allows the documented transitions", () => {
    expect(transition("available", "start")).toBe("in_progress");
    expect(transition("available", "complete")).toBe("completed");
    expect(transition("in_progress", "complete")).toBe("completed");
    expect(transition("in_progress", "cancel")).toBe("cancelled");
    expect(transition("available", "expire")).toBe("expired");
  });

  it("never leaves a terminal state", () => {
    for (const status of QUEST_STATUSES.filter(isTerminal)) {
      for (const action of ["start", "complete", "cancel", "expire"] as const) {
        expect(canTransition(status, action)).toBe(false);
      }
    }
  });

  it("cannot restart a quest already in progress", () => {
    expect(transition("in_progress", "start")).toBeNull();
  });
});
