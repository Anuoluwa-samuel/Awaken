import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { RANKS } from "@/lib/progression/config";
import { cn } from "@/lib/utils/cn";
import { getPlayerContext } from "@/server/player-context";
import { getLeaderboard, LEADERBOARD_SIZE, type LeaderboardRow } from "@/server/services/leaderboard";

export const metadata: Metadata = { title: "Leaderboard" };

const fmt = new Intl.NumberFormat("en-US");
const rankLabel = (id: LeaderboardRow["rank"]) => RANKS.find((r) => r.id === id)!.label;

function Row({ row, isViewer }: { row: LeaderboardRow; isViewer: boolean }) {
  return (
    <tr className={cn("border-b border-line last:border-0", isViewer && "bg-glow-soft")}>
      <td className="py-2.5 pl-5 pr-3 font-mono text-sm sm:pl-6">
        <span className={cn(row.place <= 3 ? "font-semibold text-glow" : "text-ink-muted")}>#{row.place}</span>
      </td>
      <td className="min-w-0 py-2.5 pr-3">
        <p className="truncate font-medium">
          {row.displayName}
          {isViewer ? <span className="ml-2 text-xs text-glow">You</span> : null}
        </p>
        {row.title ? <p className="truncate text-xs text-ink-faint">{row.title}</p> : null}
      </td>
      <td className="hidden py-2.5 pr-3 sm:table-cell">
        <Badge tone="arcane">{rankLabel(row.rank)}</Badge>
      </td>
      <td className="py-2.5 pr-3 text-right font-mono text-sm">{row.level}</td>
      <td className="py-2.5 pr-5 text-right font-mono text-sm sm:pr-6">{fmt.format(row.totalXp)}</td>
    </tr>
  );
}

export default async function LeaderboardPage() {
  const { user, profile } = await getPlayerContext();
  const { rows, total, viewer } = await getLeaderboard(db, user.id);
  const viewerBelowList = viewer && !rows.some((row) => row.userId === user.id);

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-glow">Global ranking</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-wide">Leaderboard</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {viewer ? (
            <>
              You&apos;re <span className="font-mono text-ink">#{viewer.place}</span> of{" "}
              <span className="font-mono text-ink">{fmt.format(total)}</span> ranked players.
            </>
          ) : profile.showOnLeaderboard ? (
            "Earn your first XP to join the ranking."
          ) : (
            <>
              You&apos;re hidden from the ranking. You can join it in{" "}
              <Link href="/system/settings" className="text-glow hover:underline">
                Settings
              </Link>
              .
            </>
          )}
        </p>
      </div>

      <Panel>
        <PanelHeader eyebrow={`Top ${LEADERBOARD_SIZE}`} title="Players by lifetime XP" />
        {rows.length === 0 ? (
          <EmptyState icon={Trophy}>No one&apos;s ranked yet. Complete a quest to claim first place.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">Players ranked by lifetime XP</caption>
              <thead>
                <tr className="border-b border-line-strong text-xs text-ink-faint">
                  <th scope="col" className="w-16 py-2 pl-5 pr-3 font-medium sm:w-20 sm:pl-6">
                    Place
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Player
                  </th>
                  <th scope="col" className="hidden w-36 py-2 pr-3 font-medium sm:table-cell">
                    Rank
                  </th>
                  <th scope="col" className="w-14 py-2 pr-3 text-right font-medium">
                    Level
                  </th>
                  <th scope="col" className="w-24 py-2 pr-5 text-right font-medium sm:pr-6">
                    XP
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Row key={row.userId} row={row} isViewer={row.userId === user.id} />
                ))}
                {viewerBelowList ? <Row row={viewer} isViewer /> : null}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-ink-faint">
        XP is self-reported, so treat this as friendly competition. Players on equal XP share a place. You choose whether
        you appear here in{" "}
        <Link href="/system/settings" className="hover:text-ink hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
