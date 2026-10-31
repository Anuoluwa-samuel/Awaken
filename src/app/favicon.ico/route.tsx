import { iconResponse } from "@/lib/brand/icon-image";

// Browsers and crawlers still request /favicon.ico. Modern browsers use icon.svg; this serves a
// 48px PNG (every browser accepts PNG data at this path) instead of a 404.
export const dynamic = "force-static";

export async function GET() {
  const response = await iconResponse(48);
  return new Response(response.body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
