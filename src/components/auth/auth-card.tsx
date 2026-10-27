import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Panel glow className="px-6 py-7 sm:px-8">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.25em] text-glow">{eyebrow}</p>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-wide">{title}</h1>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">{footer}</div> : null}
    </Panel>
  );
}
