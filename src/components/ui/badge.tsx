import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

export function Badge({
  className,
  tone = "default",
  ...props
}: ComponentProps<"span"> & { tone?: "default" | "glow" | "arcane" | "success" | "warning" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-display text-[11px] font-semibold uppercase tracking-[0.1em]",
        tone === "default" && "border-line-strong text-ink",
        tone === "glow" && "border-glow/40 bg-glow-soft text-glow",
        tone === "arcane" && "border-arcane/40 bg-arcane-soft text-arcane",
        tone === "success" && "border-success/40 bg-success/10 text-success",
        tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
        tone === "muted" && "border-line text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}
