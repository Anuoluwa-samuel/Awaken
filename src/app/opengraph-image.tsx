import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/brand/icon-image";
import { RANKS } from "@/lib/progression/config";
import { SITE } from "@/lib/site";

// The preview shown when an AWAKEN link is shared (WhatsApp, X, Slack, iMessage …). Next adds it
// as og:image to every page; pages without a twitter:image fall back to it too.
export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await logoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#e6edf8",
          background: "radial-gradient(circle at 85% 20%, #14306b 0%, #0a101d 45%, #060912 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={logo} width={84} height={92} alt="" />
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 14 }}>AWAKEN</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 26, letterSpacing: 8, textTransform: "uppercase", color: "#4f9dff" }}>
            A system for real-life progress
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>{SITE.tagline}</div>
          <div style={{ fontSize: 30, color: "#94a3bd", maxWidth: 900 }}>
            Quests, XP, levels, ranks and streaks for the things that matter.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {RANKS.map((rank) => (
            <div
              key={rank.id}
              style={{
                display: "flex",
                padding: "8px 18px",
                border: "2px solid #2c4170",
                borderRadius: 8,
                fontSize: 22,
                color: "#94a3bd",
              }}
            >
              {rank.label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
