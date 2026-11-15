import { expect, test } from "./fixtures";
import { PASSWORD, registerPlayer, sql, userIdFor, visit } from "./support";

test("five wrong passwords lock sign-in for 10 minutes, even for the right password", async ({ page }) => {
  const email = await registerPlayer(page);
  const userId = await userIdFor(email);
  await page.getByRole("button", { name: /player menu/i }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await visit(page, "/login");
  const attempt = async (password: string) => {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /enter the system/i }).click();
  };

  // 1–4: ordinary "invalid" message.
  for (let i = 1; i <= 4; i++) {
    await attempt(`wrong-password-${i}`);
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  }

  // 5th: locked, with a live countdown and the button disabled.
  await attempt("wrong-password-5");
  const locked = page.getByText("Sign-in paused after too many wrong passwords.");
  await expect(locked).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Sign-in paused" })).toContainText(/(10:00|9:5\d)/);
  await expect(page.getByRole("button", { name: /enter the system/i })).toBeDisabled();

  // The correct password is refused while locked (checked server-side, not just by the UI).
  await visit(page, "/login");
  await attempt(PASSWORD);
  await expect(locked).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  const [row] = await sql`select attempts, level, locked_until from auth_lockout where email = ${email}`;
  expect(row.level).toBe(1);
  const minutesLeft = (new Date(row.locked_until).getTime() - Date.now()) / 60_000;
  expect(minutesLeft).toBeGreaterThan(9);
  expect(minutesLeft).toBeLessThanOrEqual(10);

  // The API says so too, with Retry-After.
  const api = await page.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
  expect(api.status()).toBe(403);
  expect((await api.json()).code).toBe("ACCOUNT_LOCKED");
  expect(Number(api.headers()["retry-after"])).toBeGreaterThan(500);

  // Countdown over (simulated on the server's clock): the right password works and resets the lock.
  await sql`update auth_lockout set locked_until = now() - interval '1 second' where email = ${email}`;
  await visit(page, "/login");
  await attempt(PASSWORD);
  await page.waitForURL("**/system");
  const [cleared] = await sql`select attempts, level, locked_until from auth_lockout where email = ${email}`;
  expect(cleared).toMatchObject({ attempts: 0, level: 0, locked_until: null });

  // The owner was told.
  const [{ n }] = await sql`
    select count(*)::int as n from notification where user_id = ${userId} and title = 'Sign-in locked'`;
  expect(n).toBe(1);
});
