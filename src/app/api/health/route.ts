import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

// Uptime monitors can poll often: answer from the last good check for a few seconds.
const FRESH_MS = 15_000;
let lastOk = 0;

/** Liveness + database check for uptime monitors and post-deploy verification. Reveals no details. */
export async function GET() {
  try {
    if (Date.now() - lastOk > FRESH_MS) {
      await db.execute(sql`select 1`);
      lastOk = Date.now();
    }
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("health check failed", err);
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
