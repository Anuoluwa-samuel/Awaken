import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { PLAYER_PAGES, PUBLIC_PAGES } from "./pages";
import { registerPlayer, visit } from "./support";

async function audit(page: Page, path: string) {
  await visit(page, path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal") // Next.js dev overlay, not part of the app
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${path} · ${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

test("public pages have no serious accessibility violations", async ({ page }) => {
  const problems: string[] = [];
  for (const path of PUBLIC_PAGES) problems.push(...(await audit(page, path)));
  expect(problems).toEqual([]);
});

test("player pages have no serious accessibility violations", async ({ page }) => {
  await registerPlayer(page, { areas: ["learning", "fitness"] });
  // Some content, so lists and charts are audited too.
  await visit(page, "/system/quests");
  await page.getByRole("button", { name: "Complete Read or study for 30 minutes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Quest completed" })).toBeVisible();
  const problems: string[] = [];
  for (const path of PLAYER_PAGES) problems.push(...(await audit(page, path)));
  expect(problems).toEqual([]);
});

test("keyboard users can skip to content and see focus", async ({ page }) => {
  await registerPlayer(page);
  await visit(page, "/system");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  // Focus rings are visible (2px outline from :focus-visible).
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe("none");
});
