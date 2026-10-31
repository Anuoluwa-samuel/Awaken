import { expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { E2E_DATABASE_URL } from "../../playwright.config";

export const sql = postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });

export const PASSWORD = "Arise-e2e-local-0001";

export function uniqueEmail(tag: string) {
  return `${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@awaken.test`;
}

/** Waits for the logo intro to leave (Escape skips it once the page has hydrated). */
export async function dismissIntro(page: Page) {
  const intro = page.locator(".intro");
  if ((await intro.count()) === 0) return;
  await page.waitForLoadState("load");
  await page.keyboard.press("Escape").catch(() => {});
  await intro.waitFor({ state: "detached", timeout: 15_000 });
}

export async function visit(page: Page, path: string) {
  await page.goto(path);
  await dismissIntro(page);
}

export const AREAS = {
  learning: "Learning",
  fitness: "Physical fitness",
  career: "Career",
  creativity: "Creativity",
} as const;

/** Registers a new player through the UI and completes onboarding. Returns the email. */
export async function registerPlayer(page: Page, opts: { name?: string; areas?: (keyof typeof AREAS)[] } = {}) {
  const email = uniqueEmail("player");
  await visit(page, "/register");
  await page.getByLabel("Player name").fill(opts.name ?? "E2E Hunter");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: /awaken/i }).click();
  await page.waitForURL("**/onboarding");
  await dismissIntro(page);
  await expect(page.getByRole("heading", { name: "Configure your player" })).toBeVisible();
  for (const area of opts.areas ?? []) await page.getByRole("button", { name: AREAS[area], exact: true }).click();
  await page.getByRole("button", { name: "Create character" }).click();
  await page.waitForURL("**/system?welcome=1");
  await dismissIntro(page);
  return email;
}

export async function userIdFor(email: string): Promise<string> {
  const [row] = await sql`select id from "user" where email = ${email}`;
  return row.id as string;
}
