import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, siteUrl).toString(),
    lastModified,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.5,
  }));
}
