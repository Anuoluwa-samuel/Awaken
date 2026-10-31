import type { Metadata } from "next";
import { env } from "@/lib/env";

export const SITE = {
  name: "AWAKEN",
  tagline: "Level up the life you're living.",
  description:
    "Turn real-life progress into a role-playing game. Quests, levels, ranks and streaks for the things that matter.",
} as const;

const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}` };

/** Public origin, from the same setting auth uses, so links, canonicals and the sitemap agree. */
export const siteUrl = new URL(env.BETTER_AUTH_URL);

/** Pages that search engines may index. The sitemap lists exactly these. */
export const PUBLIC_ROUTES = ["/", "/register", "/login", "/terms", "/privacy"] as const;

/** Metadata for a public page: title, description, canonical URL and matching social tags. */
export function pageMetadata({ title, description, path }: { title?: string; description: string; path: string }) {
  return {
    // Omitted (not undefined) when absent, so the root layout's default title still applies.
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_US",
      url: path,
      title: title ? `${title} · ${SITE.name}` : `${SITE.name}: ${SITE.tagline}`,
      description,
      // A page's own openGraph replaces the file-based image (src/app/opengraph-image.tsx), so name it.
      images: [SHARE_IMAGE],
    },
    twitter: { card: "summary_large_image", images: [SHARE_IMAGE.url] },
  } satisfies Metadata;
}

/** For pages that only make sense to a signed-in player, or one-off links from emails. */
export const PRIVATE_PAGE: Metadata = { robots: { index: false, follow: false } };
