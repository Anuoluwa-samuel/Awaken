import type { NextConfig } from "next";

// Cache Components is off: almost every page is per-player, request-time data.
// See docs/ARCHITECTURE.md §1.
const nextConfig: NextConfig = {
  // E2E runs its own dev server alongside `pnpm dev`; a separate build dir keeps them from
  // sharing (and corrupting) one cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
