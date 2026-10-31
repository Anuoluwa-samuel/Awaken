/** Query parameters worth keeping in analytics. Everything else (?email=, ?token=, ?next=) is dropped. */
const KEPT_PARAMS = new Set(["range"]);
const ID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The URL as analytics may see it: record ids replaced with [id], no fragment, and only the query
 * parameters in KEPT_PARAMS. Keeps emails, reset tokens and per-player ids out of the dashboard.
 */
export function redactAnalyticsUrl(raw: string) {
  const url = new URL(raw);
  url.pathname = url.pathname
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? "[id]" : segment))
    .join("/");
  for (const key of [...url.searchParams.keys()]) if (!KEPT_PARAMS.has(key)) url.searchParams.delete(key);
  url.hash = "";
  return url.toString();
}
