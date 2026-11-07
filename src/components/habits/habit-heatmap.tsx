import type { HeatCell } from "@/lib/progression/habits";
import { cn } from "@/lib/utils/cn";

const STATE_CLASS: Record<HeatCell["state"], string> = {
  done: "bg-glow shadow-[0_0_6px_#2583ff99]",
  missed: "bg-surface ring-1 ring-inset ring-line-strong",
  rest: "bg-panel-raised/50",
  pending: "bg-surface ring-1 ring-inset ring-glow/60",
  future: "bg-panel-raised/10",
  before: "bg-panel-raised/25",
};
const STATE_LABEL: Record<HeatCell["state"], string> = {
  done: "checked in",
  missed: "missed",
  rest: "rest day",
  pending: "today",
  future: "",
  before: "before start",
};
const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

/** Last N weeks, Monday-first columns. Purely presentational; data comes from habitCalendar. */
export function HabitHeatmap({ weeks, label }: { weeks: HeatCell[][]; label: string }) {
  const done = weeks.flat().filter((c) => c.state === "done").length;
  return (
    <figure className="flex gap-1.5">
      <div aria-hidden className="grid grid-rows-7 gap-[3px] pt-px text-[9px] leading-[11px] text-ink-faint">
        {ROW_LABELS.map((l, i) => (
          <span key={i} className="h-[11px]">
            {l}
          </span>
        ))}
      </div>
      <div role="img" aria-label={`${label}: ${done} check-ins in the last ${weeks.length} weeks`} className="flex gap-[3px]">
        {weeks.map((week, w) => (
          <div key={w} className="grid grid-rows-7 gap-[3px]">
            {week.map((cell) => (
              <span
                key={cell.date}
                title={STATE_LABEL[cell.state] ? `${cell.date} · ${STATE_LABEL[cell.state]}` : undefined}
                className={cn("size-[11px] rounded-[2px]", STATE_CLASS[cell.state])}
              />
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
      {(["done", "missed", "rest", "pending"] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-[10px] rounded-[2px]", STATE_CLASS[s])} />
          {s === "done" ? "Checked in" : s === "missed" ? "Missed" : s === "rest" ? "Rest / any day" : "Today"}
        </span>
      ))}
    </div>
  );
}
