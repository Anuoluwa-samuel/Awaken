"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { redactAnalyticsUrl } from "@/lib/web-analytics";

/**
 * Vercel Web Analytics (page views) and Speed Insights (load-speed metrics). Both are cookie-free
 * and record no session replays; URLs are scrubbed before sending. Rendered only on Vercel.
 */
export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: redactAnalyticsUrl(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: redactAnalyticsUrl(event.url) })} />
    </>
  );
}
