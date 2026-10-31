import { expect, newPlayerContext, test } from "./fixtures";
import { PASSWORD, registerPlayer, sql, uniqueEmail, userIdFor, visit } from "./support";

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await visit(page, "/system/quests");
  await expect(page).toHaveURL(/\/login\?next=%2Fsystem%2Fquests/);
  await expect(page.getByRole("heading", { name: "Welcome back, Player" })).toBeVisible();
});

test("an open ?next redirect can't send players off-site", async ({ page, browser }) => {
  const email = await registerPlayer(page);
  const ctx = await newPlayerContext(browser);
  const fresh = await ctx.newPage();
  await visit(fresh, "/login?next=//evil.example/steal");
  await fresh.getByLabel("Email").fill(email);
  await fresh.getByLabel("Password").fill(PASSWORD);
  await fresh.getByRole("button", { name: /enter the system/i }).click();
  await fresh.waitForURL("**/system");
  expect(new URL(fresh.url()).host).toBe("localhost:3200");
  await ctx.close();
});

// 10. One player cannot access another player's records.
test("players can't see or change each other's data", async ({ page, browser }) => {
  const ownerEmail = await registerPlayer(page, { name: "Owner", areas: ["learning"] });
  const ownerId = await userIdFor(ownerEmail);
  const [quest] = await sql`select id, title from player_quest where user_id = ${ownerId} limit 1`;

  // The owner can open their quest.
  await visit(page, `/system/quests/${quest.id}`);
  await expect(page.getByRole("heading", { name: quest.title })).toBeVisible();

  // Another player gets "not found" — indistinguishable from an id that doesn't exist.
  // (Pages under /system stream behind a loading boundary, so the HTTP status is 200 with a
  // noindex tag; the content is what matters. See docs/LIMITATIONS.md.)
  const ctx = await newPlayerContext(browser);
  const intruder = await ctx.newPage();
  await registerPlayer(intruder, { name: "Intruder" });
  await visit(intruder, `/system/quests/${quest.id}`);
  await expect(intruder.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  await expect(intruder.getByRole("heading", { name: quest.title })).toHaveCount(0);
  expect(await intruder.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
  const html = await intruder.content();
  expect(html).not.toContain(ownerEmail);
  // Same result as a random, non-existent id.
  await visit(intruder, `/system/quests/${crypto.randomUUID()}`);
  await expect(intruder.getByRole("heading", { name: "Nothing here" })).toBeVisible();

  // Their own pages show none of the owner's activity.
  await visit(intruder, "/system/progress?range=7d");
  await expect(intruder.locator("dl > div").filter({ hasText: "XP earned" })).toContainText("0");
  await ctx.close();

  // And the owner's quest is untouched.
  const [after] = await sql`select status from player_quest where id = ${quest.id}`;
  expect(after.status).toBe("available");
});

test("signing out ends the session", async ({ page }) => {
  await registerPlayer(page);
  await page.getByRole("button", { name: /player menu/i }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await visit(page, "/system");
  await expect(page).toHaveURL(/\/login/);
});

test("sign-ups are limited to 5 an hour per client, not globally", async ({ browser }) => {
  const sameIp = "198.51.100.7";
  const tryRegister = async (ip: string) => {
    const ctx = await newPlayerContext(browser, ip);
    const page = await ctx.newPage();
    await visit(page, "/register");
    await page.getByLabel("Player name").fill("Spammer");
    await page.getByLabel("Email").fill(uniqueEmail("rl"));
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Confirm password").fill(PASSWORD);
    await page.getByLabel("18+").check();
    await page.getByLabel(/I agree to the Terms/).check();
    await page.getByRole("button", { name: /awaken/i }).click();
    const outcome = await Promise.race([
      page.waitForURL("**/onboarding").then(() => "registered" as const),
      page.getByText("Too many sign-ups from this network").waitFor().then(() => "limited" as const),
    ]);
    await ctx.close();
    return outcome;
  };
  const results = [];
  for (let i = 0; i < 6; i++) results.push(await tryRegister(sameIp));
  expect(results).toEqual([...Array(5).fill("registered"), "limited"]);
  // Another client is unaffected.
  expect(await tryRegister("198.51.100.8")).toBe("registered");
});

test("responses don't advertise the framework or a server version", async ({ request }) => {
  for (const path of ["/", "/login", "/api/health", "/no-such-page", "/sitemap.xml"]) {
    const headers = (await request.get(path)).headers();
    expect(headers["x-powered-by"], path).toBeUndefined();
    // Hosting may name itself (Vercel sends "Server: Vercel"), but never with a version number.
    expect(headers["server"] ?? "", path).not.toMatch(/\d/);
  }
});
