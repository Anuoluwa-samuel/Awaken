import { db } from "@/db";
import { pushConfigured, sendPush } from "@/server/push-sender";
import { sendEveningReminders } from "@/server/services/push";
import { cronAuthorised } from "../authorised";

export const dynamic = "force-dynamic";

/**
 * The evening push reminder. Called every hour (.github/workflows/reminders.yml, because Vercel's
 * free plan only runs cron daily); each player is reminded once, in their own evening.
 */
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return new Response("Not found", { status: 404 });
  if (!pushConfigured()) return Response.json({ ok: true, skipped: "push keys not set" }, { headers: { "Cache-Control": "no-store" } });
  const result = await sendEveningReminders(db, sendPush);
  console.info("[reminders]", result);
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
