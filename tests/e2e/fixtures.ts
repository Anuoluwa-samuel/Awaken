import { test as base, type Browser } from "@playwright/test";

// Rate limits are per client IP (from X-Forwarded-For — see docs/LIMITATIONS.md). Each test
// context gets its own address, like separate users behind a proxy, so tests don't share
// sign-up/sign-in buckets.
let next = 10;
export function freshIp() {
  next += 1;
  return `203.0.113.${(next % 250) + 1}`; // TEST-NET-3 documentation range
}

export const test = base.extend({
  context: async ({ browser }, provide) => {
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": freshIp() } });
    await provide(context);
    await context.close();
  },
});

export async function newPlayerContext(browser: Browser, ip = freshIp()) {
  return browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
}

export { expect } from "@playwright/test";

// Throwaway local player in the *development* database (not the E2E one), used for manual
// checks against `pnpm dev` on localhost only.
export const TEST_PLAYER = {
  name: "Test Hunter",
  email: "hunter.one@awaken.test",
  password: "Arise-local-dev-0001",
};
