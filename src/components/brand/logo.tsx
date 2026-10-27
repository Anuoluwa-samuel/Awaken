import { cn } from "@/lib/utils/cn";

/** Original AWAKEN mark: an opening eye inside a hex gate. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <path d="M16 2 28.5 9v14L16 30 3.5 23V9Z" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <path d="M7 16c2.6-4.2 5.6-6.3 9-6.3s6.4 2.1 9 6.3c-2.6 4.2-5.6 6.3-9 6.3S9.6 20.2 7 16Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2.8" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-glow", className)}>
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-[0.3em] text-ink">AWAKEN</span>
    </span>
  );
}
