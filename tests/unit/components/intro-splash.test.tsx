// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTRO_MAX_MS, INTRO_MIN_MS, IntroSplash } from "@/components/brand/intro-splash";

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduce && q.includes("reduce"),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const phase = () => document.querySelector(".intro")?.getAttribute("data-phase") ?? "gone";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  mockReducedMotion(false);
});
afterEach(() => vi.useRealTimers());

describe("IntroSplash", () => {
  it("renders the logo and an accessible loading status", () => {
    render(<IntroSplash />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading AWAKEN");
    expect(document.querySelectorAll(".intro-word span")).toHaveLength(6);
  });

  it("stays for the minimum time once loaded, then exits and unmounts", async () => {
    render(<IntroSplash />);
    await act(async () => vi.advanceTimersByTime(INTRO_MIN_MS - 100));
    expect(phase()).toBe("show");
    await act(async () => vi.advanceTimersByTime(200));
    expect(phase()).toBe("exit");
    await act(async () => vi.advanceTimersByTime(700));
    expect(phase()).toBe("gone");
  });

  it("is skippable with Escape and by clicking", async () => {
    const { unmount } = render(<IntroSplash />);
    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));
    expect(phase()).toBe("exit");
    unmount();

    render(<IntroSplash />);
    await act(async () => fireEvent.click(screen.getByRole("status")));
    expect(phase()).toBe("exit");
  });

  it("is brief when the user prefers reduced motion", async () => {
    mockReducedMotion(true);
    render(<IntroSplash />);
    await act(async () => vi.advanceTimersByTime(600));
    expect(phase()).toBe("exit");
  });

  it("never waits longer than the maximum, even if the page never finishes loading", async () => {
    const ready = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    render(<IntroSplash />);
    await act(async () => vi.advanceTimersByTime(INTRO_MIN_MS + 500));
    expect(phase()).toBe("show");
    await act(async () => vi.advanceTimersByTime(INTRO_MAX_MS));
    expect(phase()).not.toBe("show");
    ready.mockRestore();
  });
});
