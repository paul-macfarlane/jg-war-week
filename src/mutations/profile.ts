import { eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { profile } from "@/db/schema";
import type { ProfileValues } from "@/lib/profile";
import type { MutationResult } from "@/mutations/types";

/**
 * Saves the Profile of `email` (the actor's own, lowercased): upserts its
 * name and picture URL, or deletes the row when both are empty, so the
 * roster name and the Google photo show again. Takes parsed values.
 */
export async function saveProfile(
  email: string,
  values: ProfileValues,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const key = email.trim().toLowerCase();
  if (values.name === null && values.imageUrl === null) {
    await dbOrTx.delete(profile).where(eq(profile.email, key));
    return { ok: true };
  }
  await dbOrTx
    .insert(profile)
    .values({ email: key, name: values.name, imageUrl: values.imageUrl })
    .onConflictDoUpdate({
      target: profile.email,
      set: {
        name: values.name,
        imageUrl: values.imageUrl,
        updatedAt: sql`now()`,
      },
    });
  return { ok: true };
}
