import { BadgeCheck, Inbox, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import { RankBadge } from "@/components/player/rank-emblem";
import {
  AddFriendForm,
  CheerButton,
  FriendCode,
  RemoveButton,
  RequestButtons,
  VerificationButtons,
} from "@/components/friends/friend-controls";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { RANKS } from "@/lib/progression/config";
import { getPlayerContext } from "@/server/player-context";
import { FRIEND_RULES, getFriendsPage } from "@/server/services/friends";

export const metadata: Metadata = { title: "Friends" };

const when = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
const rankLabel = (id: string) => RANKS.find((r) => r.id === id)?.label ?? id;

export default async function FriendsPage() {
  const { user } = await getPlayerContext();
  const page = await getFriendsPage(db, user.id);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel glow>
          <PanelHeader as="h1" eyebrow="Party" title="Friends" />
          <div className="grid gap-5 p-5 sm:p-6">
            <div className="grid gap-2">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Your friend code</p>
              <FriendCode code={page.friendCode} />
              <p className="text-xs text-ink-faint">
                Friends see your name, level, rank, title and level-ups. Never your email or your quests, unless you ask
                one to confirm a quest.
              </p>
            </div>
            <AddFriendForm />
          </div>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Witness requests" title="Confirm a friend's quest" />
          {page.verifications.length === 0 ? (
            <EmptyState icon={BadgeCheck} title="Nothing to witness">
              When a friend asks you to confirm a quest, it shows up here. Confirmed quests earn them a small bonus.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {page.verifications.map((v) => (
                <li key={v.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium">{v.questTitle}</p>
                    <p className="text-xs text-ink-faint">
                      {v.requesterName} · completed {when(v.completedAt)} · <span className="uppercase">{v.difficulty}</span>
                    </p>
                    {v.note ? <p className="mt-1 text-sm text-ink-muted">“{v.note}”</p> : null}
                  </div>
                  <VerificationButtons id={v.id} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {page.incoming.length > 0 || page.outgoing.length > 0 ? (
        <Panel>
          <PanelHeader eyebrow="Requests" title="Pending" />
          <ul className="divide-y divide-line">
            {page.incoming.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.person.displayName}</p>
                  <p className="text-xs text-ink-faint">Wants to be friends · Lv {r.person.level}</p>
                </div>
                <RequestButtons id={r.id} />
              </li>
            ))}
            {page.outgoing.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.person.displayName}</p>
                  <p className="text-xs text-ink-faint">Request sent {when(r.since)}</p>
                </div>
                <RemoveButton id={r.id} label={`Cancel request to ${r.person.displayName}`}>
                  Cancel
                </RemoveButton>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHeader
            eyebrow="Party"
            title="Your friends"
            action={<span className="font-mono text-xs text-ink-faint">{page.friends.length}/{FRIEND_RULES.maxFriends}</span>}
          />
          {page.friends.length === 0 ? (
            <EmptyState icon={Users} title="Solo hunter">
              Share your code with a friend, or add theirs. You can cheer each other&apos;s level-ups and confirm quests.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {page.friends.map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{f.person.displayName}</p>
                    <p className="truncate text-xs text-ink-faint">{f.person.title ?? "No title"} · friends since {when(f.since)}</p>
                  </div>
                  <Badge tone="glow">Lv {f.person.level}</Badge>
                  <RankBadge rank={f.person.rank} />
                  <RemoveButton id={f.id} label={`Remove ${f.person.displayName}`} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow={`Last ${FRIEND_RULES.feedDays} days`} title="Level-ups" />
          {page.levelUps.length === 0 ? (
            <EmptyState icon={page.friends.length ? Sparkles : Inbox} title="All quiet">
              Your friends&apos; level-ups appear here for you to cheer.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {page.levelUps.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {l.name} reached <span className="text-success">level {l.toLevel}</span>
                    </p>
                    <p className="text-xs text-ink-faint">
                      {when(l.at)}
                      {l.fromRank !== l.toRank ? ` · promoted to ${rankLabel(l.toRank)}` : ""}
                    </p>
                  </div>
                  <CheerButton id={l.id} cheered={l.cheered} cheers={l.cheers} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
