import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Cron endpoints answer only to `Authorization: Bearer $CRON_SECRET`. Without the secret, they stay off. */
export function cronAuthorised(request: Request) {
  const header = request.headers.get("authorization");
  if (!env.CRON_SECRET || !header) return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
