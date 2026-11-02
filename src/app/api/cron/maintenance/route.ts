import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { env } from "@/lib/env";
import { runMaintenance } from "@/server/services/maintenance";

export const dynamic = "force-dynamic";

function authorised(header: string | null) {
  if (!env.CRON_SECRET || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily clean-up, called by Vercel Cron (vercel.json). Without CRON_SECRET set, it stays off. */
export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"))) return new Response("Not found", { status: 404 });
  const removed = await runMaintenance(db);
  console.info("[maintenance] removed", removed);
  return Response.json({ ok: true, removed }, { headers: { "Cache-Control": "no-store" } });
}
