import { SITE, siteUrl } from "@/lib/site";

/** Sitewide identity, read by Google for its Knowledge Graph and sitelinks search box. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: siteUrl.toString(),
    logo: new URL("/icon.svg", siteUrl).toString(),
  };
}

export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: siteUrl.toString(),
    description: SITE.description,
  };
}

/** What AWAKEN *is*, for the homepage: eligible for a rich result with price/platform. */
export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    url: siteUrl.toString(),
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Any (web)",
    description: SITE.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

/** Built from the guide page's own visible FAQ section — never invent questions that aren't shown. */
export function faqPageSchema(items: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}
