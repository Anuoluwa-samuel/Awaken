import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Liveness + database check for uptime monitors and post-deploy verification. Reveals no details. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("health check failed", err);
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
