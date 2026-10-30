"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { CompletionResult } from "@/server/services/quests";
import { LevelUpPanel } from "@/components/player/level-up-panel";
import type { ProgressionChange } from "@/lib/progression/rewards";
import { CompletionPanel } from "./completion-panel";

const Ctx = createContext<(r: CompletionResult) => void>(() => {});
const LevelUpCtx = createContext<(c: ProgressionChange) => void>(() => {});

/**
 * Hosts the completion message (and the level-up panel when one happened) above the page,
 * so they survive the quest row re-rendering after the server action revalidates.
 */
export function CompletionProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [levelUp, setLevelUp] = useState<ProgressionChange | null>(null);
  const show = useCallback((r: CompletionResult) => {
    setResult(r);
    if (r.levelChange) setLevelUp(r.levelChange);
  }, []);
  const close = useCallback(() => setResult(null), []);
  const closeLevelUp = useCallback(() => setLevelUp(null), []);
  return (
    <Ctx value={show}>
      <LevelUpCtx value={setLevelUp}>{children}</LevelUpCtx>
      {result ? <CompletionPanel key={result.questId} result={result} onClose={close} /> : null}
      {levelUp ? <LevelUpPanel key={levelUp.toXp} change={levelUp} onClose={closeLevelUp} /> : null}
    </Ctx>
  );
}

export const useShowCompletion = () => useContext(Ctx);
/** For rewards that aren't quest completions (e.g. habit check-ins) but still level up. */
export const useShowLevelUp = () => useContext(LevelUpCtx);
