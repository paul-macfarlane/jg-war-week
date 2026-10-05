import { and, eq, isNull, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { pointsEntry } from "@/db/schema";
import type { DiscretionaryValues } from "@/lib/discretionary-points";
import { pointsEntryTarget } from "@/lib/points-entry";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getTargetKind } from "@/queries/discretionary-points";

const NOT_FOUND = "That Discretionary points entry no longer exists.";
const NOT_DISCRETIONARY =
  "That Points Entry comes from a Competition. Change it there.";

/**
 * The columns to write for a Discretionary entry of this War Week: the
 * target must be one of its Teams or Participants (the Competition no
 * longer enforces it), and the reason is the entry's note.
 */
async function resolveColumns(
  input: DiscretionaryValues,
  warWeekId: string,
  dbOrTx: DBOrTx,
) {
  const kind = await getTargetKind(warWeekId, input.targetId, dbOrTx);
  if (!kind) {
    return {
      ok: false as const,
      error: "Choose a Team or Participant of this War Week.",
    };
  }
  return {
    ok: true as const,
    columns: {
      warWeekId,
      competitionId: null,
      ...pointsEntryTarget(kind, input.targetId),
      points: input.points,
      note: input.reason,
    },
  };
}

/**
 * Why an entry of this War Week can't be changed here: it is gone, or a
 * Competition (a generated Points Entry) owns it.
 */
async function refusalFor(
  id: string,
  warWeekId: string,
  dbOrTx: DBOrTx,
): Promise<MutationResult | null> {
  const [found] = await dbOrTx
    .select({ competitionId: pointsEntry.competitionId })
    .from(pointsEntry)
    .where(and(eq(pointsEntry.id, id), eq(pointsEntry.warWeekId, warWeekId)));
  if (!found) return { ok: false, error: NOT_FOUND };
  return found.competitionId === null
    ? null
    : { ok: false, error: NOT_DISCRETIONARY };
}

/** A Discretionary entry of this War Week, for a write. */
function discretionaryInWarWeek(id: string, warWeekId: string) {
  return and(
    eq(pointsEntry.id, id),
    eq(pointsEntry.warWeekId, warWeekId),
    isNull(pointsEntry.competitionId),
    eq(pointsEntry.generated, false),
  );
}

export async function createDiscretionaryPoints(
  input: DiscretionaryValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const resolved = await resolveColumns(input, ctx.warWeekId, dbOrTx);
  if (!resolved.ok) return resolved;
  await dbOrTx
    .insert(pointsEntry)
    .values({ ...resolved.columns, enteredByEmail: ctx.actorEmail });
  return { ok: true };
}

/**
 * Edits a Discretionary entry's target, points or reason. Its entered-by
 * email and time stay as they were; `updated_at` records the edit.
 */
export async function updateDiscretionaryPoints(
  id: string,
  input: DiscretionaryValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const refused = await refusalFor(id, ctx.warWeekId, dbOrTx);
  if (refused) return refused;
  const resolved = await resolveColumns(input, ctx.warWeekId, dbOrTx);
  if (!resolved.ok) return resolved;

  const updated = await dbOrTx
    .update(pointsEntry)
    // The database clock, like `created_at`, so the two compare exactly.
    .set({ ...resolved.columns, updatedAt: sql`now()` })
    .where(discretionaryInWarWeek(id, ctx.warWeekId))
    .returning({ id: pointsEntry.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}

export async function deleteDiscretionaryPoints(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const refused = await refusalFor(id, ctx.warWeekId, dbOrTx);
  if (refused) return refused;
  const deleted = await dbOrTx
    .delete(pointsEntry)
    .where(discretionaryInWarWeek(id, ctx.warWeekId))
    .returning({ id: pointsEntry.id });
  return deleted.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}
