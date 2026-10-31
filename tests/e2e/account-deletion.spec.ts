import { expect, test } from "./fixtures";
import { PASSWORD, registerPlayer, sql, userIdFor, visit } from "./support";

test("a player can delete their account from Settings", async ({ page }) => {
  const email = await registerPlayer(page);
  const userId = await userIdFor(email);

  // The API refuses deletion without a password, even with a brand-new session.
  const noPassword = await page.request.post("/api/auth/delete-user", {
    data: {},
    headers: { origin: "http://localhost:3200" },
  });
  expect(noPassword.status()).toBe(400);
  expect((await noPassword.json()).code).toBe("PASSWORD_REQUIRED");

  await visit(page, "/system/settings");
  await page.getByRole("button", { name: "Delete account…" }).click();
  const submit = page.getByRole("button", { name: "Delete my account" });
  await expect(submit).toBeDisabled();

  // Wrong password: refused, nothing deleted.
  await page.getByLabel("Password").fill("not-my-password");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await submit.click();
  await expect(page.getByText("That password isn't right.")).toBeVisible();
  expect(await sql`select 1 from "user" where id = ${userId}`).toHaveLength(1);

  // Right password: deleted, signed out, told so.
  await page.getByLabel("Password").fill(PASSWORD);
  await submit.click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByText("Your account and all its data have been deleted.")).toBeVisible();
  expect(await sql`select 1 from "user" where id = ${userId}`).toHaveLength(0);
  expect(await sql`select 1 from player_quest where user_id = ${userId}`).toHaveLength(0);
  expect(await sql`select 1 from xp_ledger where user_id = ${userId}`).toHaveLength(0);

  await visit(page, "/system");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /enter the system/i }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});
