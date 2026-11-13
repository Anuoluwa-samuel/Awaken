// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompletionPanel } from "@/components/quests/completion-panel";
import { levelProgress, rankProgress } from "@/lib/progression/levels";
import { applyXp } from "@/lib/progression/rewards";
import type { CompletionResult } from "@/server/services/quests";

const base: CompletionResult = {
  status: "completed",
  questId: "q1",
  questTitle: "Read or study for 30 minutes",
  xp: { requested: 25, granted: 25, note: null },
  attributes: [
    { attribute: "intelligence", granted: 2 },
    { attribute: "discipline", granted: 1 },
  ],
  levelChange: null,
  weekly: [],
  achievements: [],
  player: { level: levelProgress(25), rank: rankProgress(25) },
};

describe("CompletionPanel", () => {
  it("announces XP and attribute gains", () => {
    render(<CompletionPanel result={base} onClose={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Quest completed");
    expect(screen.getByText("+25 XP")).toBeInTheDocument();
    expect(screen.getByText("+2 INT · +1 DIS")).toBeInTheDocument();
    expect(screen.queryByText(/Level up/)).not.toBeInTheDocument();
  });

  it("announces unlocked achievements with their rewards", () => {
    render(
      <CompletionPanel
        result={{ ...base, achievements: [{ code: "first-blood", name: "First Blood", icon: "swords", xpReward: 10, titleReward: null }] }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Achievement unlocked")).toBeInTheDocument();
    expect(screen.getByText(/First Blood/)).toBeInTheDocument();
    expect(screen.getByText("+10 XP")).toBeInTheDocument();
  });

  it("merges gains to the same attribute", () => {
    render(
      <CompletionPanel
        result={{ ...base, attributes: [{ attribute: "discipline", granted: 1 }, { attribute: "discipline", granted: 1 }] }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("+2 DIS")).toBeInTheDocument();
  });

  it("shows level-ups, cap notes and weekly completions", () => {
    render(
      <CompletionPanel
        result={{
          ...base,
          xp: { requested: 50, granted: 20, note: "Daily quest XP limit of 400 reached" },
          levelChange: applyXp(90, 20),
          weekly: [{ challengeId: "w", title: "Finish three workouts", progress: 3, target: 3, completed: true, xpGranted: 100, isBoss: false }],
        }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Level up · 1 → 2/)).toBeInTheDocument();
    expect(screen.getByText(/limit of 400/)).toBeInTheDocument();
    expect(screen.getByText(/Weekly challenge complete: Finish three workouts/)).toBeInTheDocument();
  });

  it("is dismissible by button, Escape, and timeout", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<CompletionPanel result={base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.keyDown(window, { key: "Escape" });
    vi.advanceTimersByTime(6000);
    expect(onClose).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("explains a repeated completion without claiming new rewards", () => {
    render(
      <CompletionPanel
        result={{ ...base, status: "already_completed", xp: { requested: 25, granted: 0, note: "Already completed — rewards were granted once." }, attributes: [] }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Already completed")).toBeInTheDocument();
    expect(screen.queryByText(/Experience acquired/)).not.toBeInTheDocument();
  });
});
