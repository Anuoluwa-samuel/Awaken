"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { CompletionResult } from "@/server/services/quests";
import { LevelUpPanel } from "@/components/player/level-up-panel";
import { RankUpCeremony } from "@/components/player/rank-up-ceremony";
import { floatXp, playCue } from "@/lib/client/feedback";
import type { ProgressionChange } from "@/lib/progression/rewards";
import { CompletionPanel } from "./completion-panel";

const Ctx = createContext<(r: CompletionResult) => void>(() => {});
const LevelUpCtx = createContext<(c: ProgressionChange) => void>(() => {});

/** Total XP a completion paid out, bonuses included, for the floating "+N XP". */
function totalXp(r: CompletionResult) {
  return (
    r.xp.granted +
    (r.combo?.xp ?? 0) +
    r.weekly.reduce((n, w) => n + w.xpGranted, 0) +
    r.achievements.reduce((n, a) => n + (a.xpReward ?? 0), 0)
  );
}

/**
 * Hosts the completion message (and the level-up panel, or the rank-up ceremony for a new rank)
 * above the page, so they survive the quest row re-rendering after the server action revalidates.
 */
export function CompletionProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [levelUp, setLevelUp] = useState<ProgressionChange | null>(null);
  const showLevelUp = useCallback((c: ProgressionChange) => {
    setLevelUp(c);
    playCue(c.rankChanged ? "rankup" : "levelup");
  }, []);
  const show = useCallback(
    (r: CompletionResult) => {
      setResult(r);
      if (r.status !== "completed") return;
      floatXp(totalXp(r), r.combo || r.weekly.some((w) => w.isBoss && w.completed) ? "success" : "glow");
      if (r.levelChange) showLevelUp(r.levelChange);
      else playCue(r.achievements.length > 0 ? "achievement" : "complete");
    },
    [showLevelUp],
  );
  const close = useCallback(() => setResult(null), []);
  const closeLevelUp = useCallback(() => setLevelUp(null), []);
  return (
    <Ctx value={show}>
      <LevelUpCtx value={showLevelUp}>{children}</LevelUpCtx>
      {result ? <CompletionPanel key={result.questId} result={result} onClose={close} /> : null}
      {levelUp?.rankChanged ? (
        <RankUpCeremony key={levelUp.toXp} change={levelUp} onClose={closeLevelUp} />
      ) : levelUp ? (
        <LevelUpPanel key={levelUp.toXp} change={levelUp} onClose={closeLevelUp} />
      ) : null}
    </Ctx>
  );
}

export const useShowCompletion = () => useContext(Ctx);
/** For rewards that aren't quest completions (e.g. habit check-ins) but still level up. */
export const useShowLevelUp = () => useContext(LevelUpCtx);
