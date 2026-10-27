import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint",
        "transition-[border-color,box-shadow] focus-visible:border-glow focus-visible:shadow-glow focus-visible:outline-none",
        "aria-invalid:border-danger disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink",
        "focus-visible:border-glow focus-visible:shadow-glow focus-visible:outline-none aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
