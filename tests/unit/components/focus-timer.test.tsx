// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const completeFocusAction = vi.fn();
vi.mock("@/app/system/focus/actions", () => ({
  completeFocusAction: (id: string) => completeFocusAction(id),
  startFocusAction: vi.fn(),
  pauseFocusAction: vi.fn(),
  resumeFocusAction: vi.fn(),
  endFocusEarlyAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { FocusTimer } = await import("@/components/focus/focus-timer");

const NOW = "2026-10-31T10:00:00.000Z";
const session = (startedSecondsAgo: number, status: "running" | "paused" = "running") => ({
  id: "s1",
  status,
  startedAt: new Date(Date.parse(NOW) - startedSecondsAgo * 1000),
  pausedAt: status === "paused" ? new Date(Date.parse(NOW) - 60_000) : null,
  totalPausedSeconds: 0,
  plannedSeconds: 1500,
  questTitle: null,
});

beforeEach(() => {
  completeFocusAction.mockReset();
  completeFocusAction.mockResolvedValue({
    ok: true,
    serverNow: NOW,
    data: { status: "already_ended", session: {} },
  });
});

describe("FocusTimer", () => {
  it("shows the remaining time derived from server timestamps", () => {
    render(<FocusTimer initial={session(600)} serverNow={NOW} hasDeepFocus={false} quests={[]} />);
    expect(screen.getByRole("timer")).toHaveTextContent("15:00");
  });

  it("freezes while paused (paused time doesn't count)", () => {
    render(<FocusTimer initial={session(600, "paused")} serverNow={NOW} hasDeepFocus={false} quests={[]} />);
    // Started 10 min ago, paused for the last minute → 9 focused minutes, 16 remaining.
    expect(screen.getByRole("timer")).toHaveTextContent("Paused16:00");
    expect(completeFocusAction).not.toHaveBeenCalled();
  });

  it("completes exactly once when reopened after the session ended", async () => {
    await act(async () => {
      render(<FocusTimer initial={session(3000)} serverNow={NOW} hasDeepFocus={false} quests={[]} />);
    });
    expect(completeFocusAction).toHaveBeenCalledTimes(1);
    expect(completeFocusAction).toHaveBeenCalledWith("s1");
  });

  it("offers Deep Focus lengths only with the skill", () => {
    const { rerender } = render(<FocusTimer initial={null} serverNow={NOW} hasDeepFocus={false} quests={[]} />);
    expect(screen.queryByRole("button", { name: "90m" })).not.toBeInTheDocument();
    rerender(<FocusTimer initial={null} serverNow={NOW} hasDeepFocus quests={[]} />);
    expect(screen.getByRole("button", { name: "90m" })).toBeInTheDocument();
  });
});
