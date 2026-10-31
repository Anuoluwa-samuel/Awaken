import { eq } from "drizzle-orm";
import type { AppDb } from "@/db/types";
import { auditEvent, authLockout, verification } from "@/db/schema";
import { normaliseEmail } from "@/lib/auth/lockout-rules";

/**
 * Removes what deleting the user row wouldn't: rows that mention the player without a cascading
 * foreign key. Everything else (sessions, credentials, profile, quests, ledgers, notifications …)
 * references `user.id` with ON DELETE CASCADE and goes with the user row itself.
 */
export async function purgeAccountExtras(db: AppDb, userId: string, email: string) {
  await db.transaction(async (tx) => {
    // Audit rows keep a nullable actor; for a deleted player, drop them rather than orphan them.
    await tx.delete(auditEvent).where(eq(auditEvent.actorUserId, userId));
    // Pending password-reset tokens store the user id as their value.
    await tx.delete(verification).where(eq(verification.value, userId));
    const key = normaliseEmail(email);
    if (key) await tx.delete(authLockout).where(eq(authLockout.email, key));
  });
}
