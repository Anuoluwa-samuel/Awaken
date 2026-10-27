export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-6">
      <span className="sr-only">Loading player data…</span>
      <div className="h-48 animate-pulse rounded-lg border border-line bg-panel/60" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg border border-line bg-panel/60" />
        <div className="h-64 animate-pulse rounded-lg border border-line bg-panel/60" />
      </div>
    </div>
  );
}
