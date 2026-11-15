"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

/** A password field with a show/hide toggle. Same props as a plain `<input type="password">`. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentProps<"input">, "type">>(
  function PasswordInput({ className, id, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          className={cn(
            "h-10 w-full rounded-md border border-line bg-surface px-3 pr-10 text-sm text-ink placeholder:text-ink-faint",
            "transition-[border-color,box-shadow] focus-visible:border-glow focus-visible:shadow-glow focus-visible:outline-none",
            "aria-invalid:border-danger disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-controls={id}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-faint hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
