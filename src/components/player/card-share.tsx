"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Saves the character card PNG, or opens the phone's share sheet where it can share files.
 * The image is only ever the signed-in player's own card.
 */
export function CardShare() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getFile() {
    const res = await fetch("/system/card", { cache: "no-store" });
    if (!res.ok) throw new Error("card");
    return new File([await res.blob()], "awaken-card.png", { type: "image/png" });
  }

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const file = await getFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My AWAKEN character card" });
      } else {
        const url = URL.createObjectURL(file);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Couldn't make the card. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={share} disabled={busy}>
        <Share2 className="size-4" />
        {busy ? "Generating…" : "Character card"}
      </Button>
      <a href="/system/card" target="_blank" rel="noopener" className="text-xs text-ink-faint hover:text-ink">
        Preview
      </a>
      {error ? (
        <p role="alert" className="w-full text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
