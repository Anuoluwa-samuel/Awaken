import type { NextConfig } from "next";

// Cache Components is off: almost every page is per-player, request-time data.
// See docs/ARCHITECTURE.md §1.
const nextConfig: NextConfig = {
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
