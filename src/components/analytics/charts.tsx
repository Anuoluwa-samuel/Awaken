"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSyncExternalStore } from "react";
import { shortDate } from "@/lib/analytics";

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Charts skip their grow-in animation for people who prefer reduced motion. */
function useAnimate() {
  const reduced = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => true,
  );
  return !reduced;
}

// Chart conventions (see the dataviz skill): thin marks, 4px rounded data ends on the baseline,
// solid hairline grid, one y-axis, colour follows the series (fixed slot order), legend for ≥ 2
// series, hover tooltip on every chart. Colours come from CSS tokens in globals.css.

const AXIS = { stroke: "var(--color-ink-faint)", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID = <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />;

type Row = { date: string } & Record<string, number | string>;

type TooltipProps = {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; name?: unknown; value?: unknown; color?: string }[];
  label?: unknown;
  unit?: string;
  weekly?: boolean;
};

function ChartTooltip({ active, payload, label, unit, weekly }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line-strong bg-panel-raised px-3 py-2 text-xs shadow-panel">
      <p className="mb-1 text-ink-muted">{weekly ? `Week of ${shortDate(String(label))}` : shortDate(String(label))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink">
          <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-muted">{String(p.name)}</span>
          <span className="ml-auto font-mono">
            {String(p.value)}
            {unit ? ` ${unit}` : ""}
          </span>
        </p>
      ))}
    </div>
  );
}

const xTicks = () => ({
  dataKey: "date",
  tickFormatter: (d: string) => shortDate(d),
  interval: "preserveStartEnd" as const,
  minTickGap: 24,
  ...AXIS,
});

/** One series per day/week as bars (XP, focus minutes). */
export function SeriesBarChart({
  data,
  dataKey,
  name,
  unit,
  weekly,
}: {
  data: Row[];
  dataKey: string;
  name: string;
  unit?: string;
  weekly?: boolean;
}) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
        {GRID}
        <XAxis {...xTicks()} />
        <YAxis {...AXIS} allowDecimals={false} width={40} />
        <Tooltip cursor={{ fill: "var(--color-glow-soft)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} unit={unit} weekly={weekly} />} />
        <Bar isAnimationActive={animate} dataKey={dataKey} name={name} fill="var(--color-series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Scheduled quests per day: completed vs missed (expired or skipped), stacked. */
export function QuestOutcomeChart({ data, weekly }: { data: Row[]; weekly?: boolean }) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
        {GRID}
        <XAxis {...xTicks()} />
        <YAxis {...AXIS} allowDecimals={false} width={40} />
        <Tooltip cursor={{ fill: "var(--color-glow-soft)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} weekly={weekly} />} />
        <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-muted)" }} />
        <Bar isAnimationActive={animate} dataKey="completed" name="Completed" stackId="q" fill="var(--color-series-1)" maxBarSize={28} stroke="var(--color-panel)" strokeWidth={2} />
        <Bar isAnimationActive={animate} dataKey="missed" name="Missed" stackId="q" fill="var(--color-series-muted)" radius={[4, 4, 0, 0]} maxBarSize={28} stroke="var(--color-panel)" strokeWidth={2} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const ATTRIBUTE_SERIES = [
  { key: "strength", name: "Strength", color: "var(--color-series-1)" },
  { key: "intelligence", name: "Intelligence", color: "var(--color-series-2)" },
  { key: "discipline", name: "Discipline", color: "var(--color-series-3)" },
  { key: "vitality", name: "Vitality", color: "var(--color-series-4)" },
  { key: "creativity", name: "Creativity", color: "var(--color-series-5)" },
] as const;

/** Cumulative attribute points — five fixed-colour lines on one axis. */
export function AttributeChart({ data }: { data: Row[] }) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        {GRID}
        <XAxis {...xTicks()} />
        <YAxis {...AXIS} allowDecimals={false} width={40} />
        <Tooltip cursor={{ stroke: "var(--color-line-strong)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} unit="pts" />} />
        <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--color-ink-muted)" }} />
        {ATTRIBUTE_SERIES.map((s) => (
          <Line isAnimationActive={animate} key={s.key} type="linear" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--color-panel)", strokeWidth: 2 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Completions by category, largest first (single series). */
export function CategoryChart({ data }: { data: { label: string; completed: number }[] }) {
  const animate = useAnimate();
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke="var(--color-chart-grid)" />
        <XAxis type="number" {...AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="label" {...AXIS} width={140} />
        <Tooltip
          cursor={{ fill: "var(--color-glow-soft)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-md border border-line-strong bg-panel-raised px-3 py-2 text-xs shadow-panel">
                <span className="text-ink-muted">{String(payload[0].payload.label)}</span>{" "}
                <span className="font-mono text-ink">{payload[0].value} completed</span>
              </div>
            ) : null
          }
        />
        <Bar isAnimationActive={animate} dataKey="completed" name="Completed" fill="var(--color-series-1)" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
