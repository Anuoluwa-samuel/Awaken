import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Label + control + hint/error, wired for screen readers via ids. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error" && "border-danger/40 bg-danger/10 text-danger",
        tone === "success" && "border-success/40 bg-success/10 text-success",
        tone === "info" && "border-glow/40 bg-glow-soft text-ink",
      )}
    >
      {children}
    </div>
  );
}
