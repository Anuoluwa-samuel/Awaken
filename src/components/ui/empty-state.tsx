import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <Icon aria-hidden className="size-6 text-ink-faint" />
      <p className="max-w-xs text-sm text-ink-muted">{children}</p>
    </div>
  );
}
