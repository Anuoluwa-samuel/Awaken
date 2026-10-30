"use client";

import { Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { unlockSkillAction } from "@/app/system/skills/actions";
import { Button } from "@/components/ui/button";

/**
 * Rendered for every skill (not only unlockable ones) so the result message survives the
 * card switching to "unlocked" when the page revalidates.
 */
export function SkillUnlock({ code, name, cost, canUnlock }: { code: string; name: string; cost: number; canUnlock: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      {confirm ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await unlockSkillAction(code);
                setConfirm(false);
                setMessage(
                  r.ok
                    ? {
                        tone: "ok",
                        text: [`${r.data.name} unlocked.`, ...r.data.achievements.map((a) => `Achievement: ${a.name}.`)].join(" "),
                      }
                    : { tone: "error", text: r.error },
                );
              })
            }
          >
            {pending ? "Unlocking…" : `Spend ${cost} point${cost === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : !canUnlock ? null : (
        <Button size="sm" onClick={() => setConfirm(true)}>
          <Sparkles aria-hidden />
          Unlock<span className="sr-only"> {name}</span>
        </Button>
      )}
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-xs text-danger" : "text-xs text-success"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
