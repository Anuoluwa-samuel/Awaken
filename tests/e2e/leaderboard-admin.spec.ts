import { execFileSync } from "node:child_process";
import { E2E_DATABASE_URL } from "../../playwright.config";
import { expect, newPlayerContext, test } from "./fixtures";
import { registerPlayer, sql, userIdFor, visit } from "./support";

test("the leaderboard ranks players and respects the opt-out", async ({ page, browser }) => {
  const email = await registerPlayer(page, { name: "Top Hunter", areas: ["learning"] });
  const userId = await userIdFor(email);
  await sql`update player_progress set total_xp = 999999, level = 90, rank = 'N' where user_id = ${userId}`;

  const ctx = await newPlayerContext(browser);
  const rival = await ctx.newPage();
  await registerPlayer(rival, { name: "Rival Hunter" });
  await visit(rival, "/system/leaderboard");
  const row = rival.getByRole("row").filter({ hasText: "Top Hunter" });
  await expect(row).toContainText("#1");
  await expect(row).toContainText("999,999");
  expect(await rival.content()).not.toContain(email);
  await expect(rival.getByText("Earn your first XP to join the ranking.")).toBeVisible();

  await visit(page, "/system/settings");
  await page.getByLabel(/Show me on the global leaderboard/).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Player status updated.")).toBeVisible();
  await visit(rival, "/system/leaderboard");
  await expect(rival.getByRole("row").filter({ hasText: "Top Hunter" })).toHaveCount(0);
  await visit(page, "/system/leaderboard");
  await expect(page.getByText(/You're hidden from the ranking/)).toBeVisible();
  await ctx.close();
});

test("the sidebar collapses to icons and remembers it", async ({ page }) => {
  await registerPlayer(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const aside = page.locator("aside");
  await expect.poll(() => aside.evaluate((el) => el.getBoundingClientRect().width)).toBe(260);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(() => aside.evaluate((el) => el.getBoundingClientRect().width)).toBe(68);

  // Icons still navigate, keep their names, and the choice survives a reload.
  await aside.getByRole("link", { name: "Quests" }).click();
  await page.waitForURL("**/system/quests");
  await page.reload();
  await expect.poll(() => aside.evaluate((el) => el.getBoundingClientRect().width)).toBe(68);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => aside.evaluate((el) => el.getBoundingClientRect().width)).toBe(260);
});

test("only admins can open the dashboard, and nobody can promote themselves", async ({ page }) => {
  await visit(page, "/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);

  const email = await registerPlayer(page, { name: "Plain Player" });
  await visit(page, "/admin");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  await visit(page, "/system");
  await page.getByRole("button", { name: /player menu/i }).click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Admin dashboard" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // A request can't set the role.
  const forged = await page.request.post("/api/auth/update-user", {
    data: { role: "admin" },
    headers: { origin: "http://localhost:3200" },
  });
  expect(forged.ok()).toBe(false);
  expect((await sql`select role from "user" where email = ${email}`)[0].role).toBe("player");

  // The grant script is the only way in.
  const run = (...args: string[]) =>
    execFileSync("pnpm", ["admin:grant", ...args], {
      env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, MIGRATION_DATABASE_URL: E2E_DATABASE_URL },
      encoding: "utf8",
    });
  expect(run(email)).toContain("is now: admin");

  await visit(page, "/system");
  await page.getByRole("button", { name: /player menu/i }).click();
  await page.getByRole("menuitem", { name: "Admin dashboard" }).click();
  await page.waitForURL("**/admin");
  await expect(page.getByRole("heading", { name: "Analytics dashboard" })).toBeVisible();
  await expect(page.locator("dt", { hasText: "Accounts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign-ups" })).toBeVisible();
  expect(await page.content()).not.toContain(email);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

  expect(run(email, "--revoke")).toContain("is now: player");
  await visit(page, "/admin");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
});
