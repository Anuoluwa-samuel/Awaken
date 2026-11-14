import { E2E_CRON_SECRET } from "../../playwright.config";
import { expect, newPlayerContext, test } from "./fixtures";
import { PASSWORD, registerPlayer, sql, uniqueEmail, userIdFor, visit } from "./support";

const today = () => new Date().toISOString().slice(0, 10);

test("floods are throttled per client with a Retry-After, and others are unaffected", async ({ request }) => {
  const hit = (ip: string) => request.get("/api/health", { headers: { "x-forwarded-for": ip } });
  const flood = await Promise.all(Array.from({ length: 200 }, () => hit("198.51.100.77")));
  const limited = flood.filter((r) => r.status() === 429);
  expect(limited.length).toBeGreaterThan(0);
  expect(Number(limited[0]!.headers()["retry-after"])).toBeGreaterThan(0);
  expect(flood.filter((r) => r.status() === 200).length).toBeGreaterThanOrEqual(100);
  expect((await hit("198.51.100.78")).status()).toBe(200);
});

test("the prerendered pages and sign-in are served as normal", async ({ page }) => {
  await visit(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await visit(page, "/login");
  await expect(page.getByRole("heading", { name: "Welcome back, Player" })).toBeVisible();
});

test("server actions are rate limited, then recover", async ({ page }) => {
  const email = await registerPlayer(page);
  const userId = await userIdFor(email);
  await visit(page, "/system/settings");
  await sql`insert into rate_limit (id, key, count, last_request)
    values (${crypto.randomUUID()}, ${`app:actions:${userId}`}, 60, ${Date.now()})
    on conflict (key) do update set count = 60, last_request = excluded.last_request`;
  await page.locator("#displayName").fill("Faster Hunter");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("You're going a little fast.")).toBeVisible();

  await sql`delete from rate_limit where key = ${`app:actions:${userId}`}`;
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Player status updated.")).toBeVisible();
});

test("daily quotas are enforced and shown to the player", async ({ page }) => {
  const email = await registerPlayer(page);
  const userId = await userIdFor(email);
  await sql`insert into usage_counter (scope, metric, day, count) values (${userId}, 'settings_saved', ${today()}, 30)`;
  await visit(page, "/system/settings");
  await expect(page.locator("dl > div").filter({ hasText: "Settings changes" })).toContainText("30/30");
  await page.locator("#displayName").fill("Quota Hunter");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("You've reached today's limit of 30 for settings changes.")).toBeVisible();
  const [profile] = await sql`select display_name from player_profile where user_id = ${userId}`;
  expect(profile.display_name).not.toBe("Quota Hunter");
});

test("the site-wide budgets stop sign-ups and emails without revealing anything", async ({ browser }) => {
  const seed = async (metric: string, count: number) =>
    sql`insert into usage_counter (scope, metric, day, count) values ('site', ${metric}, ${today()}, ${count})
      on conflict (scope, metric, day) do update set count = excluded.count`;
  const ctx = await newPlayerContext(browser);
  const page = await ctx.newPage();

  const [{ count: before }] = await sql`select coalesce(sum(count), 0)::int as count from usage_counter where scope = 'site' and metric = 'signups' and day = ${today()}`;
  await seed("signups", 500);
  try {
    await visit(page, "/register");
    await page.getByLabel("Player name").fill("Late Comer");
    await page.getByLabel("Email").fill(uniqueEmail("budget"));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByLabel("18+").check();
    await page.getByLabel(/I agree to the Terms/).check();
    await page.getByRole("button", { name: /awaken/i }).click();
    await expect(page.getByText("New sign-ups are paused for today.")).toBeVisible();
  } finally {
    await seed("signups", before);
  }

  // Create the account while there's budget, then use up the email budget.
  const owner = await ctx.newPage();
  const email = await registerPlayer(owner);
  await seed("emails_sent", 90);
  try {
    await visit(page, "/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: /send|reset/i }).click();
    await expect(page.getByText("If an account exists for that email")).toBeVisible();
    await expect
      .poll(async () => (await sql`select count from usage_counter where scope = 'site' and metric = 'emails_skipped' and day = ${today()}`)[0]?.count ?? 0)
      .toBeGreaterThan(0);
  } finally {
    await seed("emails_sent", 0);
  }
  await ctx.close();
});

test("the maintenance job needs its secret", async ({ request }) => {
  expect((await request.get("/api/cron/maintenance")).status()).toBe(404);
  const wrong = await request.get("/api/cron/maintenance", { headers: { authorization: "Bearer nope" } });
  expect(wrong.status()).toBe(404);
  const right = await request.get("/api/cron/maintenance", { headers: { authorization: `Bearer ${E2E_CRON_SECRET}` } });
  expect(right.status()).toBe(200);
  expect((await right.json()).ok).toBe(true);
});
