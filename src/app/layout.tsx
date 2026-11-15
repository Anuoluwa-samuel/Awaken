import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono, Montserrat } from "next/font/google";
import { IntroSplash } from "@/components/brand/intro-splash";
import { LogoDefs } from "@/components/brand/logo";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata, SITE, siteUrl } from "@/lib/site";
import { organizationSchema, webSiteSchema } from "@/lib/structured-data";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["800"] });

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: SITE.name,
  // Social defaults only; each public page sets its own canonical URL.
  ...pageMetadata({ description: SITE.description, path: "/" }),
  alternates: undefined,
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s · ${SITE.name}` },
};

export const viewport: Viewport = {
  themeColor: "#060912",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${chakra.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
        <LogoDefs />
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}
