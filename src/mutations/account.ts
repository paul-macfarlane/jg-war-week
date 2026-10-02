import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { organizer, profile, user } from "@/db/schema";
import { removeOrganizer } from "@/mutations/organizers";
import type { MutationResult } from "@/mutations/types";

/**
 * Deletes a person's account: their Organizer-list entry (refused while
 * they're the last Organizer, with nothing deleted), their Profile and their
 * `user` (sessions and sign-in accounts cascade). Roster records, Host rows
 * and every email-keyed audit column stay: they belong to the War Week, and
 * signing in again later re-links by email.
 */
export async function deleteAccount(
  email: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const normalized = email.trim().toLowerCase();
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    // Locked first, as `removeOrganizer` does, so a concurrent removal
    // can't slip between this check and the last-Organizer rule.
    const organizers = await tx
      .select({ email: organizer.email })
      .from(organizer)
      .for("update");
    const listed = organizers.some((row) => row.email === normalized);
    if (listed) {
      const removed = await removeOrganizer(normalized, normalized, tx);
      if (!removed.ok) return removed;
    }
    await tx.delete(profile).where(eq(profile.email, normalized));
    await tx.delete(user).where(eq(user.email, normalized));
    return { ok: true };
  });
}
