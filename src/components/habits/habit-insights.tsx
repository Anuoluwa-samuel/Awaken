import type { WeekdayInsight } from "@/lib/progression/habits";

/** Consistency skill: check-ins by weekday over the last 12 weeks. */
export function HabitInsights({ days, strongest }: { days: WeekdayInsight[]; strongest: string | null }) {
  const max = Math.max(1, ...days.map((d) => d.due ?? d.done));
  return (
    <div className="rounded-md border border-line bg-surface/50 p-3">
      <p className="text-[11px] uppercase tracking-wider text-ink-faint">
        Weekday insights{strongest ? <> · strongest on <span className="text-ink">{strongest}</span></> : null}
      </p>
      <ul className="mt-2 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const label =
            d.due === null ? `${d.label}: ${d.done} check-ins` : d.due === 0 ? `${d.label}: rest day` : `${d.label}: ${d.done} of ${d.due}`;
          return (
            <li key={d.day} className="flex flex-col items-center gap-1" aria-label={label} title={label}>
              <div className="flex h-10 w-full items-end overflow-hidden rounded-sm bg-panel-raised/40">
                <div
                  className="w-full rounded-sm bg-glow/80"
                  style={{ height: `${((d.due === null ? d.done : d.due ? d.done : 0) / (d.due ?? max)) * 100}%` }}
                />
              </div>
              <span aria-hidden className="text-[10px] text-ink-faint">
                {d.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
