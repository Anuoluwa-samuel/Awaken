import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RANK_COLORS } from "@/components/player/rank-emblem";

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const token = (name: string) => {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i"));
  if (!match) throw new Error(`token --color-${name} not found`);
  return match[1];
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("palette", () => {
  it("uses the brand colours", () => {
    expect(token("bg")).toBe("#080f1f");
    expect(token("panel")).toBe("#101c30");
    expect(token("line")).toBe("#24344d");
    expect(token("glow")).toBe("#2583ff");
    expect(token("success")).toBe("#b6ff4a");
  });

  it.each(["ink", "ink-muted", "ink-faint", "glow", "frost", "success", "warning", "danger"])(
    "%s text is readable (≥ 4.5:1) on every background",
    (name) => {
      for (const bg of ["bg", "surface", "panel", "panel-raised"]) {
        expect(contrast(token(name), token(bg)), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("primary buttons keep dark text readable on electric blue", () => {
    expect(contrast(token("bg"), token("glow"))).toBeGreaterThanOrEqual(4.5);
  });

  it("every rank's letter is readable on the darkest background", () => {
    for (const [rank, c] of Object.entries(RANK_COLORS)) {
      expect(contrast(c.text, token("bg")), rank).toBeGreaterThanOrEqual(4.5);
    }
  });
});
