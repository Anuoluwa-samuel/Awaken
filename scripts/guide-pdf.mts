// Saves the player guide as a PDF: `pnpm guide:pdf [site-url] [output-file]`.
// Needs the site running at site-url (default: the local dev server).
import { chromium } from "@playwright/test";

const [site = "http://localhost:3100", output = "AWAKEN-Player-Guide.pdf"] = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(new URL("/guide", site).toString(), { waitUntil: "load" });
// Let the intro finish and React settle first, or a later render would undo the edits below.
await page.keyboard.press("Escape");
await page.locator(".intro").waitFor({ state: "detached", timeout: 20_000 });
await page.waitForTimeout(1000);
await page.emulateMedia({ media: "print", colorScheme: "light" });
await page.evaluate(() => {
  // The site's dark color-scheme would otherwise paint the page margins dark.
  document.querySelector('meta[name="color-scheme"]')?.remove();
  document.documentElement.style.colorScheme = "light";
  // Keep "on this page" jumps, but don't bake the machine's site address into other links.
  for (const link of document.querySelectorAll("a[href]")) {
    if (link.getAttribute("href")!.startsWith("#")) continue;
    if (link.querySelector("svg")) link.removeAttribute("href");
    else link.replaceWith(link.textContent ?? "");
  }
});
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: output,
  format: "A4",
  printBackground: true,
  outline: true,
  tagged: true,
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate:
    '<div style="width:100%;padding:0 16mm;font-size:8px;color:#55617a;display:flex;justify-content:space-between"><span>AWAKEN Player Guide</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
});
await browser.close();
console.log(`Saved ${output}`);
