import { expect, newPlayerContext, test } from "./fixtures";
import { PASSWORD, sql, uniqueEmail, visit } from "./support";

async function fillSignUp(page: import("@playwright/test").Page, email: string) {
  await visit(page, "/register");
  await page.getByLabel("Player name").fill("Spam Check");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByLabel("18+").check();
  await page.getByLabel(/I agree to the Terms/).check();
}

test("a bot that fills the hidden honeypot field is refused", async ({ page }) => {
  const email = uniqueEmail("honeypot");
  await fillSignUp(page, email);
  // Invisible to people and skipped by keyboard and screen readers…
  const honeypot = page.locator("#website");
  await expect(honeypot).toHaveAttribute("tabindex", "-1");
  expect(await page.getByRole("textbox", { name: "Website" }).count()).toBe(0);
  // …but a form-filling bot finds it.
  await honeypot.fill("https://cheap-pills.example", { force: true });
  await page.getByRole("button", { name: /awaken/i }).click();
  await expect(page.getByText("We couldn't create that account.")).toBeVisible();
  expect(await sql`select 1 from "user" where email = ${email}`).toHaveLength(0);
});

test("scripts posting straight to the sign-up API are refused", async ({ request }) => {
  for (const formToken of [undefined, "123.forged"]) {
    const response = await request.post("/api/auth/sign-up/email", {
      data: { name: "Script", email: uniqueEmail("script"), password: PASSWORD, ageAnswer: "adult", acceptTerms: true, formToken },
      headers: { origin: "http://localhost:3200", "x-forwarded-for": "203.0.113.200" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe("SIGN_UP_BLOCKED");
  }
  expect(await sql`select 1 from "user" where name = 'Script'`).toHaveLength(0);
});

test("temporary inbox addresses get a clear message", async ({ browser }) => {
  const ctx = await newPlayerContext(browser);
  const page = await ctx.newPage();
  await fillSignUp(page, `spam.${Date.now()}@mailinator.com`);
  await page.getByRole("button", { name: /awaken/i }).click();
  await expect(page.getByText("Use a permanent email address.")).toBeVisible();
  await ctx.close();
});
