import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Player pages are behind sign-in and marked noindex as well; this just saves crawlers the trip.
    rules: { userAgent: "*", allow: "/", disallow: ["/system", "/onboarding", "/api/"] },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
