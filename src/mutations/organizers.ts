import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { organizer } from "@/db/schema";
import { isJahnelGroupEmail } from "@/lib/access";
import { isUniqueViolation } from "@/mutations/setup";
import type { MutationResult } from "@/mutations/types";

const NOT_JG = "An Organizer needs an @jahnelgroup.com email.";
const LAST_ORGANIZER = "The last Organizer can't be removed.";

const alreadyOrganizer = (email: string) => `${email} is already an Organizer.`;

/**
 * Adds a JG email to the global Organizer list, lowercased, recording who
 * added it. Refuses a non-JG email and one already listed (ignoring case).
 * Global, so it takes the actor's email rather than a `MutationContext`.
 */
export async function addOrganizer(
  email: string,
  actorEmail: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  if (!isJahnelGroupEmail(email)) return { ok: false, error: NOT_JG };
  const normalized = email.trim().toLowerCase();
  try {
    const inserted = await dbOrTx
      .insert(organizer)
      .values({ email: normalized, addedBy: actorEmail.trim().toLowerCase() })
      .onConflictDoNothing({ target: organizer.email })
      .returning({ id: organizer.id });
    return inserted.length > 0
      ? { ok: true }
      : { ok: false, error: alreadyOrganizer(normalized) };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: false, error: alreadyOrganizer(normalized) };
  }
}

/**
 * Removes an Organizer, refusing to remove the last one. Every `organizer`
 * row is locked before counting, so two concurrent removals of the last two
 * can't both commit: the second waits, recounts and is refused. Removing
 * yourself is fine while another Organizer remains.
 */
export async function removeOrganizer(
  email: string,
  actorEmail: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const normalized = email.trim().toLowerCase();
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const rows = await tx
      .select({ email: organizer.email })
      .from(organizer)
      .for("update");
    if (!rows.some((row) => row.email === normalized)) {
      return { ok: false, error: `${normalized} isn't an Organizer.` };
    }
    if (rows.length === 1) return { ok: false, error: LAST_ORGANIZER };
    await tx.delete(organizer).where(eq(organizer.email, normalized));
    return { ok: true };
  });
}
