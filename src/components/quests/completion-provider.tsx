"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { CompletionResult } from "@/server/services/quests";
import { CompletionPanel } from "./completion-panel";

const Ctx = createContext<(r: CompletionResult) => void>(() => {});

/** Hosts the completion message above the page so it survives the quest row re-rendering. */
export function CompletionProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<CompletionResult | null>(null);
  const close = useCallback(() => setResult(null), []);
  return (
    <Ctx value={setResult}>
      {children}
      {result ? <CompletionPanel key={result.questId} result={result} onClose={close} /> : null}
    </Ctx>
  );
}

export const useShowCompletion = () => useContext(Ctx);
