import { cn } from "@/lib/utils/cn";

export function ProgressBar({
  value,
  label,
  className,
  tone = "glow",
}: {
  /** 0–1 */
  value: number;
  label: string;
  className?: string;
  tone?: "glow" | "arcane" | "success";
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface ring-1 ring-line", className)}
    >
      <div
        className={cn(
          "h-full origin-left animate-fill rounded-full",
          tone === "glow" && "bg-gradient-to-r from-[#2f6fd6] to-glow shadow-[0_0_12px_#4f9dff88]",
          tone === "arcane" && "bg-gradient-to-r from-[#6a4fd6] to-arcane shadow-[0_0_12px_#9b7bff88]",
          tone === "success" && "bg-success",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
