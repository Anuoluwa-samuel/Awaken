import { ATTRIBUTE_INFO, type Attribute } from "@/lib/progression/config";

export function AttributeList({ attributes }: { attributes: { attribute: Attribute; points: number }[] }) {
  const max = Math.max(20, ...attributes.map((a) => a.points));
  return (
    <ul className="grid gap-3 px-5 py-4">
      {attributes.map(({ attribute, points }) => {
        const info = ATTRIBUTE_INFO[attribute];
        return (
          <li key={attribute} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-3">
            <abbr title={info.label} className="font-display text-sm font-bold tracking-wider text-frost no-underline">
              {info.short}
            </abbr>
            <div>
              <p className="text-sm">{info.label}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface ring-1 ring-line" aria-hidden>
                <div className="h-full origin-left animate-fill rounded-full bg-frost/80" style={{ width: `${(points / max) * 100}%` }} />
              </div>
            </div>
            <span className="text-right font-mono text-lg font-semibold">{points}</span>
          </li>
        );
      })}
    </ul>
  );
}
