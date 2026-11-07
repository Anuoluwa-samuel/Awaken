import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompleteForm } from "@/components/quests/complete-form";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { db } from "@/db";
import { ATTRIBUTE_INFO, CATEGORY_INFO } from "@/lib/progression/config";
import { questIdSchema } from "@/lib/validation/quest";
import { getPlayerContext } from "@/server/player-context";
import { getQuestDetail } from "@/server/services/quests";

export const metadata: Metadata = { title: "Quest" };

const METHOD_LABEL = {
  self_reported: "Self-reported",
  focus_session: "Focus session",
  habit: "Habit check-in",
  integration: "Integration",
} as const;

export default async function QuestDetailPage({ params }: PageProps<"/system/quests/[id]">) {
  const { id } = await params;
  if (!questIdSchema.safeParse(id).success) notFound();
  const { user } = await getPlayerContext();
  // Scoped to the signed-in player: another player's quest is a 404, not a 403.
  const detail = await getQuestDetail(db, user.id, id);
  if (!detail) notFound();
  const { quest, completion, xp, attributes } = detail;
  const open = quest.status === "available" || quest.status === "in_progress";

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/system/quests" className="inline-flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Quest log
      </Link>

      <Panel glow>
        <PanelHeader
          as="h1"
          eyebrow={quest.kind === "custom" ? "Custom quest" : quest.kind === "daily" ? "Daily quest" : "Quest"}
          title={quest.title}
          action={<span className="font-mono text-lg font-semibold text-glow">+{quest.xpReward} XP</span>}
        />
        <div className="grid gap-5 p-5 sm:p-6">
          {quest.description ? <p className="text-ink-muted">{quest.description}</p> : null}
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Item label="Status" value={quest.status.replace("_", " ")} />
            <Item label="Category" value={CATEGORY_INFO[quest.category].label} />
            <Item label="Difficulty" value={quest.difficulty} />
            <Item label="Attribute" value={ATTRIBUTE_INFO[quest.attribute].label} />
            <Item label="Quest day" value={quest.questDate} />
            {quest.dueAt ? <Item label="Due" value={quest.dueAt.toLocaleString()} /> : null}
            {quest.estimatedMinutes ? <Item label="Estimate" value={`${quest.estimatedMinutes} min`} /> : null}
          </dl>
          {quest.checklist?.length ? (
            <div>
              <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Checklist</h2>
              <ul className="mt-2 grid gap-1 text-sm">
                {quest.checklist.map((item, i) => (
                  <li key={i} className="flex gap-2 text-ink-muted">
                    <span aria-hidden>▸</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {open ? <CompleteForm questId={quest.id} status={quest.status as "available" | "in_progress"} title={quest.title} /> : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Ledger" title="Reward history" />
        {completion ? (
          <div className="grid gap-3 p-5 text-sm sm:p-6">
            <p>
              Completed {completion.completedAt.toLocaleString()} · <Badge tone="muted">{METHOD_LABEL[completion.method]}</Badge>
            </p>
            {completion.evidenceNote ? (
              <blockquote className="border-l-2 border-line-strong pl-3 text-ink-muted">{completion.evidenceNote}</blockquote>
            ) : null}
            <ul className="grid gap-1.5">
              {xp.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="text-ink-muted">{e.reason}</span>
                  <span className="font-mono text-glow">+{e.amount} XP</span>
                </li>
              ))}
              {attributes.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="text-ink-muted">{ATTRIBUTE_INFO[a.attribute].label}</span>
                  <span className="font-mono text-frost">+{a.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="p-5 text-sm text-ink-muted sm:p-6">
            {open ? "No rewards yet — complete the quest to earn them." : `This quest was ${quest.status}; no rewards were granted.`}
          </p>
        )}
      </Panel>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}
