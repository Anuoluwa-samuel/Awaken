import { db } from "@/db";
import { runMaintenance } from "@/server/services/maintenance";
import { cronAuthorised } from "../authorised";

export const dynamic = "force-dynamic";

/** Daily clean-up, called by .github/workflows/maintenance.yml. Without CRON_SECRET set, it stays off. */
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return new Response("Not found", { status: 404 });
  const removed = await runMaintenance(db);
  console.info("[maintenance] removed", removed);
  return Response.json({ ok: true, removed }, { headers: { "Cache-Control": "no-store" } });
}
