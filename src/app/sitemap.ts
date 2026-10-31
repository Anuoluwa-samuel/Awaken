import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.5,
  }));
}
