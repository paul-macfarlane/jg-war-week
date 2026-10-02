import { and, eq, isNotNull, ne, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { awardCategory } from "@/db/schema";
import { isUniqueViolation } from "@/mutations/setup";
import type { MutationResult } from "@/mutations/types";

const NOT_FOUND = "That Category no longer exists.";

const alreadyNamed = (name: string) =>
  `There's already a Category named ${name}.`;

/** Whether another Category (not `exceptId`) has this name, ignoring case. */
async function nameTaken(
  name: string,
  exceptId: string | null,
  dbOrTx: DBOrTx,
): Promise<boolean> {
  const taken = await dbOrTx
    .select({ id: awardCategory.id })
    .from(awardCategory)
    .where(
      and(
        sql`lower(${awardCategory.name}) = lower(${name})`,
        exceptId ? ne(awardCategory.id, exceptId) : undefined,
      ),
    );
  return taken.length > 0;
}

/**
 * Adds a global Award Category. `name` is already trimmed and validated;
 * one already taken (ignoring case) is refused.
 */
export async function createAwardCategory(
  name: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  if (await nameTaken(name, null, dbOrTx)) {
    return { ok: false, error: alreadyNamed(name) };
  }
  try {
    await dbOrTx.insert(awardCategory).values({ name });
    return { ok: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: false, error: alreadyNamed(name) };
  }
}

/** Renames a Category, archived or not; its seed key stays. */
export async function renameAwardCategory(
  id: string,
  name: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  if (await nameTaken(name, id, dbOrTx)) {
    return { ok: false, error: alreadyNamed(name) };
  }
  try {
    const updated = await dbOrTx
      .update(awardCategory)
      .set({ name, updatedAt: sql`now()` })
      .where(eq(awardCategory.id, id))
      .returning({ id: awardCategory.id });
    return updated.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: false, error: alreadyNamed(name) };
  }
}

/**
 * Archives a Category: it stays on the Awards that have it, and can't be
 * picked for others. Archiving twice is fine.
 */
export async function archiveAwardCategory(
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const updated = await dbOrTx
    .update(awardCategory)
    .set({
      archivedAt: sql`coalesce(${awardCategory.archivedAt}, now())`,
      updatedAt: sql`now()`,
    })
    .where(eq(awardCategory.id, id))
    .returning({ id: awardCategory.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}

/** Restores an archived Category, so it can be picked again. */
export async function restoreAwardCategory(
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const restored = await dbOrTx
    .update(awardCategory)
    .set({ archivedAt: null, updatedAt: sql`now()` })
    .where(and(eq(awardCategory.id, id), isNotNull(awardCategory.archivedAt)))
    .returning({ id: awardCategory.id });
  if (restored.length > 0) return { ok: true };
  const [exists] = await dbOrTx
    .select({ id: awardCategory.id })
    .from(awardCategory)
    .where(eq(awardCategory.id, id));
  return {
    ok: false,
    error: exists ? "That Category isn't archived." : NOT_FOUND,
  };
}
