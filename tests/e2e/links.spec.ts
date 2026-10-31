import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { PLAYER_PAGES, PUBLIC_PAGES } from "./pages";
import { registerPlayer, visit } from "./support";

const ORIGIN = "http://localhost:3200";

type Problem = { from: string; target: string; issue: string };

/**
 * Crawls every page reachable by following links from the start pages, as the given visitor
 * (signed out or signed in), and reports links that 404/500, land on "Nothing here", or point at a
 * #fragment that doesn't exist. Also checks every image, icon and manifest the pages reference.
 */
async function crawl(page: Page, start: readonly string[]) {
  const queue = [...start];
  const seen = new Set(queue);
  const problems: Problem[] = [];
  const assets = new Map<string, string>(); // url → first page that referenced it
  const fragments: { from: string; target: string }[] = [];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const response = await visit(page, path);
    const status = response?.status() ?? 0;
    if (status >= 400) {
      problems.push({ from: "(crawl)", target: path, issue: `HTTP ${status}` });
      continue;
    }
    if (await page.getByRole("heading", { name: "Nothing here" }).count()) {
      problems.push({ from: "(crawl)", target: path, issue: "renders Nothing here" });
      continue;
    }

    const found = await page.evaluate(() => ({
      links: [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].map((a) => a.getAttribute("href")!),
      assets: [
        ...[...document.querySelectorAll<HTMLImageElement>("img[src]")].map((i) => i.src),
        ...[...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map(
          (l) => l.href,
        ),
        ...[...document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]')].map(
          (m) => m.content,
        ),
      ],
    }));

    for (const raw of found.links) {
      if (raw.startsWith("mailto:") || raw.startsWith("tel:")) continue;
      const url = new URL(raw, `${ORIGIN}${path}`);
      if (url.origin !== ORIGIN) {
        problems.push({ from: path, target: raw, issue: "external link (check by hand)" });
        continue;
      }
      if (url.hash && url.pathname === new URL(path, ORIGIN).pathname) {
        fragments.push({ from: path, target: url.hash });
        continue;
      }
      if (url.pathname.startsWith("/api/")) continue;
      const target = url.pathname + url.search;
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
    for (const asset of found.assets) if (!assets.has(asset)) assets.set(asset, path);

    for (const { target } of fragments.splice(0)) {
      const id = decodeURIComponent(target.slice(1));
      if (!(await page.locator(`[id="${id}"]`).count())) problems.push({ from: path, target, issue: "missing #fragment" });
    }
  }

  for (const [asset, from] of assets) {
    const response = await page.request.get(asset);
    if (!response.ok()) problems.push({ from, target: asset, issue: `asset HTTP ${response.status()}` });
  }
  return { visited: [...seen], problems };
}

test("the crawler itself catches dead links and missing pages", async ({ page }) => {
  const { problems } = await crawl(page, ["/no-such-page"]);
  expect(problems).toEqual([{ from: "(crawl)", target: "/no-such-page", issue: "HTTP 404" }]);
});

test.describe("no broken links", () => {
  test.setTimeout(240_000);

  test("signed out", async ({ page }) => {
    const { visited, problems } = await crawl(page, PUBLIC_PAGES);
    test.info().annotations.push({ type: "crawled", description: visited.join(" ") });
    expect(visited.length).toBeGreaterThanOrEqual(PUBLIC_PAGES.length);
    expect(problems).toEqual([]);
  });

  test("signed in", async ({ page }) => {
    await registerPlayer(page, { areas: ["learning", "fitness"] });
    const { visited, problems } = await crawl(page, ["/", ...PLAYER_PAGES]);
    test.info().annotations.push({ type: "crawled", description: visited.join(" ") });
    // Quest detail pages are reached through links, not listed up front.
    expect(visited.some((p) => /^\/system\/quests\/[0-9a-f-]{36}$/.test(p))).toBe(true);
    expect(problems).toEqual([]);
  });
});
