import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Everything is served from our own origin: next/font self-hosts fonts and there are no
// third-party scripts. 'unsafe-inline' is needed for Next's inline bootstrap scripts and for
// inline styles (charts, animations); 'unsafe-eval' only in development (React Refresh).
// Cloudflare Turnstile is the one exception, and only when its key is set (see docs/DEPLOYMENT.md).
const captchaOrigin = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? " https://challenges.cloudflare.com" : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}${captchaOrigin}`,
  ...(captchaOrigin ? [`frame-src${captchaOrigin}`] : []),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isProd ? "" : " ws:"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

// Cache Components is off: almost every page is per-player, request-time data.
// See docs/ARCHITECTURE.md §1.
const nextConfig: NextConfig = {
  // E2E runs its own dev server alongside `pnpm dev`; a separate build dir keeps them from
  // sharing (and corrupting) one cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-hosted (Docker): bundles a minimal Node server + only the deps it needs, instead of all
  // of node_modules. See the Dockerfile and docs/DEPLOYMENT.md.
  output: "standalone",
  cacheComponents: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
