import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** The signature "system window": layered panel with luminous corner brackets. */
export function Panel({
  className,
  children,
  glow = false,
  ...props
}: ComponentProps<"section"> & { glow?: boolean }) {
  return (
    <section
      className={cn(
        "relative rounded-lg border border-line bg-panel/80 shadow-panel backdrop-blur-sm",
        glow && "border-line-strong shadow-[var(--shadow-panel),var(--shadow-glow)]",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="pointer-events-none absolute -left-px -top-px size-3 rounded-tl-lg border-l-2 border-t-2 border-glow/70" />
      <span aria-hidden className="pointer-events-none absolute -right-px -top-px size-3 rounded-tr-lg border-r-2 border-t-2 border-glow/70" />
      <span aria-hidden className="pointer-events-none absolute -bottom-px -left-px size-3 rounded-bl-lg border-b-2 border-l-2 border-glow/40" />
      <span aria-hidden className="pointer-events-none absolute -bottom-px -right-px size-3 rounded-br-lg border-b-2 border-r-2 border-glow/40" />
      {children}
    </section>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  action,
  className,
  as: Heading = "h2",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-glow">{eyebrow}</p>
        ) : null}
        <Heading className="font-display text-lg font-semibold tracking-wide text-ink">{title}</Heading>
      </div>
      {action}
    </header>
  );
}
