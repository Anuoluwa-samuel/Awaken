import { count, eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { db } from "@/db";
import { playerAchievement, playerAttribute, playerProfile, playerProgress } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { logoDataUri } from "@/lib/brand/icon-image";
import { ATTRIBUTES, ATTRIBUTE_INFO } from "@/lib/progression/config";
import { levelProgress, rankProgress } from "@/lib/progression/levels";
import { questDay } from "@/lib/time";
import { getDayStreak } from "@/server/services/streak";

export const dynamic = "force-dynamic";

// Rank accents, matching the in-app badges: steel → blue → lime.
const ACCENT: Record<string, string> = { E: "#9aa8c0", D: "#8cc2ff", C: "#4d9bff", B: "#2583ff", A: "#b6ff4a", S: "#b6ff4a", N: "#d9ffa3" };

/**
 * The signed-in player's character card as a PNG, to save or share. Private: it only ever renders
 * the requester's own card, and shows no email or account details.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Not signed in", { status: 401 });
  const userId = session.user.id;
  const profile = await db.query.playerProfile.findFirst({ where: eq(playerProfile.userId, userId) });
  if (!profile) return new Response("No player", { status: 404 });

  const today = questDay(new Date(), profile.timeZone, profile.dayStartHour);
  const [progress, attributes, [achievements], streak, logo] = await Promise.all([
    db.query.playerProgress.findFirst({ where: eq(playerProgress.userId, userId) }),
    db.query.playerAttribute.findMany({ where: eq(playerAttribute.userId, userId) }),
    db.select({ n: count() }).from(playerAchievement).where(eq(playerAchievement.userId, userId)),
    getDayStreak(db, userId, { today, timeZone: profile.timeZone, dayStartHour: profile.dayStartHour }),
    logoDataUri(),
  ]);
  const totalXp = progress?.totalXp ?? 0;
  const level = levelProgress(totalXp);
  const rank = rankProgress(totalXp).rank;
  const accent = ACCENT[rank.id] ?? "#2583ff";
  const points = Object.fromEntries(attributes.map((a) => [a.attribute, a.points]));
  const max = Math.max(20, ...ATTRIBUTES.map((a) => points[a] ?? 0));
  const fmt = new Intl.NumberFormat("en");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 56,
          color: "#e8eef8",
          background: "radial-gradient(circle at 80% 10%, #13305f 0%, #0b1426 45%, #080f1f 100%)",
          border: `3px solid ${accent}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og, not the browser */}
            <img src={logo} width={44} height={48} alt="" />
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 10 }}>AWAKEN</div>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 6, color: "#8cc2ff", textTransform: "uppercase" }}>Player status</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 48 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 180,
              height: 180,
              borderRadius: 28,
              border: `4px solid ${accent}`,
              background: "#101c30",
              boxShadow: `0 0 60px ${accent}66`,
              fontSize: rank.id === "N" ? 96 : 120,
              fontWeight: 800,
              color: accent,
            }}
          >
            {rank.id}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{profile.displayName.slice(0, 24)}</div>
            <div style={{ fontSize: 28, color: profile.equippedTitle ? "#8cc2ff" : "#7f8dab" }}>
              {profile.equippedTitle ?? "No title equipped"}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 28 }}>
              <div style={{ display: "flex", color: accent, fontWeight: 700 }}>{rank.label}</div>
              <div style={{ display: "flex", color: "#7f8dab" }}>·</div>
              <div style={{ display: "flex" }}>Level {level.level}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 64 }}>
          {ATTRIBUTES.map((a) => (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ width: 70, fontSize: 24, fontWeight: 700, color: "#8cc2ff", letterSpacing: 3 }}>{ATTRIBUTE_INFO[a].short}</div>
              <div style={{ display: "flex", flex: 1, height: 16, borderRadius: 8, background: "#0b1426", border: "1px solid #24344d" }}>
                <div style={{ width: `${((points[a] ?? 0) / max) * 100}%`, height: "100%", borderRadius: 8, background: "#2583ff" }} />
              </div>
              <div style={{ width: 70, fontSize: 26, fontWeight: 700, textAlign: "right", justifyContent: "flex-end", display: "flex" }}>
                {points[a] ?? 0}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: "auto" }}>
          {[
            ["Lifetime XP", fmt.format(totalXp)],
            ["Day streak", String(streak.current)],
            ["Achievements", String(achievements?.n ?? 0)],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", flex: 1, padding: "16px 22px", borderRadius: 12, border: "1px solid #24344d", background: "#101c30" }}
            >
              <div style={{ fontSize: 18, letterSpacing: 3, textTransform: "uppercase", color: "#7f8dab" }}>{label}</div>
              <div style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 900,
      height: 1040,
      headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="awaken-card.png"` },
    },
  );
}
