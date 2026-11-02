import { expect, test } from "./fixtures";
import { PUBLIC_PAGES } from "./pages";
import { registerPlayer, visit } from "./support";

const ORIGIN = "http://localhost:3200";
const INDEXED = ["/", "/guide", "/register", "/login", "/terms", "/privacy"];

test("public pages have a title, description, canonical URL and share image", async ({ page, request }) => {
  const titles = new Set<string>();
  for (const path of INDEXED) {
    await visit(page, path);
    const title = await page.title();
    expect(title, path).toMatch(/AWAKEN/);
    titles.add(title);
    const meta = (selector: string) => page.locator(selector).getAttribute("content");
    expect((await meta('meta[name="description"]'))?.length, path).toBeGreaterThan(50);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical ?? "").href).toBe(new URL(path, ORIGIN).href);
    expect(await meta('meta[property="og:image"]')).toBe(`${ORIGIN}/opengraph-image`);
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(await page.locator('meta[name="robots"]').count()).toBe(0);
  }
  expect(titles.size).toBe(INDEXED.length);

  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("private pages are kept out of search results", async ({ page }) => {
  for (const path of PUBLIC_PAGES.filter((p) => !INDEXED.includes(p))) {
    await visit(page, path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  }
  await registerPlayer(page);
  for (const path of ["/system", "/system/quests", "/system/settings"]) {
    await visit(page, path);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
  }
});

test("robots.txt, sitemap, manifest and icons are served", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /system");
  expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  const urls = [...sitemap.matchAll(/<loc>(.+?)<\/loc>/g)].map((m) => m[1]);
  expect(urls).toEqual(INDEXED.map((path) => `${ORIGIN}${path}`));

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("AWAKEN");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);

  for (const [path, type] of [
    ["/favicon.ico", "image/png"],
    ["/icon.svg", "image/svg+xml"],
    ["/apple-icon", "image/png"],
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toBe(type);
  }
});
