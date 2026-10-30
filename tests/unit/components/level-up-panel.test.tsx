// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEVEL_UP_AUTO_CLOSE_MS, LevelUpPanel } from "@/components/player/level-up-panel";
import { RankEmblem } from "@/components/player/rank-emblem";
import { CompletionProvider, useShowCompletion } from "@/components/quests/completion-provider";
import { xpToReach } from "@/lib/progression/levels";
import { levelProgress, rankProgress } from "@/lib/progression/levels";
import { applyXp } from "@/lib/progression/rewards";
import type { CompletionResult } from "@/server/services/quests";

afterEach(() => vi.useRealTimers());

describe("LevelUpPanel", () => {
  it("shows the levels gained and the skill point reward", () => {
    render(<LevelUpPanel change={applyXp(90, 20)} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Level up" })).toBeInTheDocument();
    expect(screen.getByText("Lv 1")).toBeInTheDocument();
    expect(screen.getByText("Lv 2")).toBeInTheDocument();
    expect(screen.getByText("1 skill point")).toBeInTheDocument();
    expect(screen.queryByText(/Rank up/)).not.toBeInTheDocument();
  });

  it("celebrates rank-ups and multi-level jumps", () => {
    render(<LevelUpPanel change={applyXp(0, xpToReach(10))} onClose={() => {}} />);
    expect(screen.getByText("9 levels gained at once")).toBeInTheDocument();
    expect(screen.getByText("Rank up · D-Rank")).toBeInTheDocument();
    expect(screen.getByText("Promotion to D-Rank")).toBeInTheDocument();
    expect(screen.getByText("9 skill points")).toBeInTheDocument();
  });

  it("closes on Continue, Escape and after a timeout, without trapping focus", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const before = document.activeElement;
    render(<LevelUpPanel change={applyXp(90, 20)} onClose={onClose} />);
    expect(document.activeElement).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => vi.advanceTimersByTime(LEVEL_UP_AUTO_CLOSE_MS));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("CompletionProvider", () => {
  const result = (levelChange: CompletionResult["levelChange"]): CompletionResult => ({
    status: "completed",
    questId: "q",
    questTitle: "Complete a workout",
    xp: { requested: 25, granted: 25, note: null },
    attributes: [],
    levelChange,
    weekly: [],
    achievements: [],
    player: { level: levelProgress(110), rank: rankProgress(110) },
  });

  function Trigger({ r }: { r: CompletionResult }) {
    const show = useShowCompletion();
    return <button onClick={() => show(r)}>go</button>;
  }

  it("opens the level-up panel only when a level was gained", () => {
    const { unmount } = render(
      <CompletionProvider>
        <Trigger r={result(null)} />
      </CompletionProvider>,
    );
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByText("Quest completed")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Level up" })).not.toBeInTheDocument();
    unmount();

    render(
      <CompletionProvider>
        <Trigger r={result(applyXp(85, 25))} />
      </CompletionProvider>,
    );
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("heading", { name: "Level up" })).toBeInTheDocument();
  });
});

describe("RankEmblem", () => {
  it("is an image with a name when titled, decorative otherwise", () => {
    const { rerender } = render(<RankEmblem rank="S" title="S-Rank" />);
    expect(screen.getByRole("img", { name: "S-Rank" })).toBeInTheDocument();
    rerender(<RankEmblem rank="S" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
