import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Nothing here yet, said in the System's voice: a framed glyph, a one-line System message and a
 * hint about what fills the space.
 */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <span className="empty-glyph" aria-hidden>
        <Icon className="size-5" />
      </span>
      {title ? (
        <p className="mt-1 font-display text-[11px] font-semibold uppercase tracking-[0.25em] text-glow">{title}</p>
      ) : null}
      <p className="max-w-xs text-sm text-ink-muted">{children}</p>
    </div>
  );
}
