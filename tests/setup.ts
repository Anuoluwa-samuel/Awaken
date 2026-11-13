import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Surprise System events are random per player and day; tests that want one turn them on.
process.env.SYSTEM_EVENTS = "off";

// RTL only auto-cleans when Vitest globals are on; we keep them off.
afterEach(() => cleanup());
