import { expect, test } from "./fixtures";
import { PLAYER_PAGES, PUBLIC_PAGES } from "./pages";
import { registerPlayer, visit } from "./support";

// Runs in the "mobile" project (Pixel 7 viewport): no page may scroll sideways.
test("no page overflows horizontally on a phone", async ({ page }) => {
  const overflowing: string[] = [];
  const check = async (path: string) => {
    await visit(page, path);
    await page.waitForLoadState("networkidle");
    const { scroll, width } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }));
    if (scroll > width + 1) overflowing.push(`${path}: ${scroll}px > ${width}px`);
  };
  for (const path of PUBLIC_PAGES) await check(path);
  await registerPlayer(page, { areas: ["learning"] });
  for (const path of PLAYER_PAGES) await check(path);
  expect(overflowing).toEqual([]);
});

test("every section is reachable from the mobile menu", async ({ page }) => {
  await registerPlayer(page);
  await visit(page, "/system");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "System menu" });
  for (const label of ["Status", "Quests", "Profile", "Habits", "Focus", "Goals", "Skills", "Achievements", "Progress", "Notifications", "Settings"]) {
    await expect(menu.getByRole("link", { name: label })).toBeVisible();
  }
  await menu.getByRole("link", { name: "Goals" }).click();
  await expect(page).toHaveURL(/\/system\/goals$/);
  await expect(menu).toHaveCount(0);
});
