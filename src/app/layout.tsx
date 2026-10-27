import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono, Montserrat } from "next/font/google";
import { IntroSplash } from "@/components/brand/intro-splash";
import { LogoDefs } from "@/components/brand/logo";
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
  title: { default: "AWAKEN", template: "%s · AWAKEN" },
  description: "Turn real-life progress into a role-playing game. Quests, levels, ranks and streaks for the things that matter.",
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
        <LogoDefs />
        <IntroSplash />
        {children}
      </body>
    </html>
  );
}
