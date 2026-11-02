import { expect, test } from "./fixtures";
import { issueFormToken } from "@/lib/auth/spam-rules";
import { LEGAL } from "@/lib/legal";
import { E2E_AUTH_SECRET } from "../../playwright.config";
import { PASSWORD, sql, uniqueEmail, visit } from "./support";

test("sign-up asks a neutral age question and records consent", async ({ page }) => {
  await visit(page, "/register");
  const email = uniqueEmail("teen");
  await page.getByLabel("Player name").fill("Young Hunter");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  const submit = page.getByRole("button", { name: /awaken/i });

  // Nothing preselected; submitting without an answer asks for one.
  for (const option of ["Under 13", "13–17", "18+"]) await expect(page.getByLabel(option)).not.toBeChecked();
  await page.getByLabel(/I agree to the Terms/).check();
  await submit.click();
  await expect(page.getByText("Choose your age range")).toBeVisible();

  // Under 13: blocked in the form.
  await page.getByLabel("Under 13").check();
  await expect(page.getByText("Sorry, you need to be 13 or older to use AWAKEN.")).toBeVisible();
  await expect(submit).toBeDisabled();

  // 13–17: needs a parent or guardian's permission.
  await page.getByLabel("13–17").check();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Under 18s need a parent or guardian's permission to use AWAKEN.")).toBeVisible();
  await page.getByLabel("A parent or guardian has agreed to me using AWAKEN.").check();
  await submit.click();
  await page.waitForURL("**/onboarding");

  const [row] = await sql`select age_group, terms_accepted_at, terms_version from "user" where email = ${email}`;
  expect(row.age_group).toBe("teen");
  expect(row.terms_version).toBe(LEGAL.updated);
  expect(Date.now() - new Date(row.terms_accepted_at).getTime()).toBeLessThan(60_000);
});

test("the sign-up API enforces the same rules as the form", async ({ request }) => {
  let n = 0;
  // A different client IP per call keeps this clear of the 3-per-minute sign-up limit.
  const signUp = (extra: object) =>
    request.post("/api/auth/sign-up/email", {
      // A valid form token, as the register page would issue, so these hit the consent checks.
      data: { name: "Bypass", email: uniqueEmail("api"), password: PASSWORD, formToken: issueFormToken(E2E_AUTH_SECRET), ...extra },
      headers: { origin: "http://localhost:3200", "x-forwarded-for": `203.0.113.${++n}` },
    });
  const refused = async (extra: object, code: string) => {
    const response = await signUp(extra);
    expect(response.status()).toBe(400);
    expect((await response.json()).code).toBe(code);
  };
  await refused({}, "AGE_REQUIREMENT_NOT_MET");
  await refused({ ageAnswer: "under13", acceptTerms: true }, "AGE_REQUIREMENT_NOT_MET");
  await refused({ ageAnswer: "teen", acceptTerms: true }, "GUARDIAN_CONSENT_REQUIRED");
  await refused({ ageAnswer: "adult" }, "TERMS_NOT_ACCEPTED");
  // The stored columns can't be set directly.
  const forged = await signUp({ ageAnswer: "adult", acceptTerms: true, ageGroup: "adult", termsVersion: "x" });
  expect(forged.status()).toBe(400);
  expect(await sql`select 1 from "user" where name = 'Bypass'`).toHaveLength(0);
});
