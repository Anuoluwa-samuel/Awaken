import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { verifyCaptcha } from "@/lib/auth/captcha";
import { createThrottle } from "@/lib/throttle";

describe("request throttle", () => {
  it("allows a burst up to capacity, then refuses and says when to retry", () => {
    const take = createThrottle({ capacity: 3, refillPerSecond: 1 });
    expect([take("a", 0), take("a", 0), take("a", 0)].every((r) => r.allowed)).toBe(true);
    expect(take("a", 0)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("refills over time, never above capacity", () => {
    const take = createThrottle({ capacity: 2, refillPerSecond: 1 });
    take("a", 0);
    take("a", 0);
    expect(take("a", 500).allowed).toBe(false);
    expect(take("a", 1500).allowed).toBe(true);
    // A long idle gap only restores the capacity.
    expect([take("a", 99_000), take("a", 99_000)].every((r) => r.allowed)).toBe(true);
    expect(take("a", 99_000).allowed).toBe(false);
  });

  it("keeps clients apart and bounds its memory", () => {
    const take = createThrottle({ capacity: 1, refillPerSecond: 0.001, maxKeys: 2 });
    expect(take("a", 0).allowed).toBe(true);
    expect(take("a", 0).allowed).toBe(false);
    expect(take("b", 0).allowed).toBe(true);
    take("c", 0); // evicts the least recently used key
    expect(take("c", 0).allowed).toBe(false);
  });
});

describe("verifyCaptcha", () => {
  const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

  it("needs a token, and sends it with the secret", async () => {
    const fetchImpl = reply({ success: true });
    expect(await verifyCaptcha(null, "s", null, fetchImpl)).toBe("missing");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await verifyCaptcha("tok", "s", null, fetchImpl)).toBe("ok");
    expect(JSON.parse(fetchImpl.mock.calls[0]![1 as never]!["body" as never])).toEqual({ secret: "s", response: "tok" });
  });

  it("rejects a failed token, and reports outages separately", async () => {
    expect(await verifyCaptcha("tok", "s", null, reply({ success: false }))).toBe("rejected");
    expect(await verifyCaptcha("tok", "s", null, reply({}, false))).toBe("unavailable");
    const down = vi.fn(async () => {
      throw new Error("network");
    });
    expect(await verifyCaptcha("tok", "s", null, down)).toBe("unavailable");
  });
});

// "Everywhere" stays true only if a new action can't quietly skip the limit.
describe("server actions", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : name === "actions.ts" ? [full] : [];
    });

  it("every exported action passes through the rate limit", () => {
    const found = files("src/app");
    expect(found.length).toBeGreaterThanOrEqual(9);
    for (const file of found) {
      const source = readFileSync(file, "utf8");
      const usesRun = /async function run</.test(source);
      if (usesRun) expect(source.match(/async function run<[\s\S]*?\n}\n/)?.[0], file).toContain("guardAction");
      const actions = source.split(/(?=^export async function )/m).slice(1);
      expect(actions.length, file).toBeGreaterThan(0);
      for (const action of actions) {
        const name = action.match(/function (\w+)/)?.[1];
        expect(/guardAction\(|return run\(/.test(action), `${file}: ${name}`).toBe(true);
      }
    }
  });
});
