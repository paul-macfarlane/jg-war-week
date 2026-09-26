import { and, eq, inArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, pointsEntry } from "@/db/schema";
import {
  type PointsEntryValues,
  pointsEntryTarget,
  pointsEntryTargetError,
} from "@/lib/points-entry";
import { locked } from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";
import {
  getCompetitionInWarWeek,
  getTargetKind,
} from "@/queries/points-entries";

const NOT_FOUND = "That Points Entry no longer exists.";
const FROM_BRACKET = "This Points Entry comes from a bracket. Change it there.";

/**
 * The columns to write for a Points Entry of this War Week: the Competition
 * must belong to it, and the target must be one of its Teams or
 * Participants of the kind the Competition's scoring allows.
 */
async function resolveColumns(
  input: PointsEntryValues,
  warWeekId: string,
  dbOrTx: DBOrTx,
) {
  const [found, kind] = await Promise.all([
    getCompetitionInWarWeek(warWeekId, input.competitionId, dbOrTx),
    getTargetKind(warWeekId, input.targetId, dbOrTx),
  ]);
  if (!found) {
    return {
      ok: false as const,
      error: "Choose a Competition of this War Week.",
    };
  }
  if (!kind) {
    return {
      ok: false as const,
      error: "Choose a Team or Participant of this War Week.",
    };
  }
  const refusal = pointsEntryTargetError(found, kind);
  if (refusal) return { ok: false as const, error: `${refusal}.` };

  return {
    ok: true as const,
    columns: {
      competitionId: input.competitionId,
      ...pointsEntryTarget(kind, input.targetId),
      points: input.points,
      note: input.note,
    },
  };
}

/** Only Points Entries whose Competition belongs to the War Week. */
function inWarWeek(id: string, warWeekId: string, dbOrTx: DBOrTx) {
  return and(
    eq(pointsEntry.id, id),
    inArray(
      pointsEntry.competitionId,
      dbOrTx
        .select({ id: competition.id })
        .from(competition)
        .where(eq(competition.warWeekId, warWeekId)),
    ),
  );
}

/** Refuses a Points Entry a finalized Bracket generated. */
async function generatedRefusal(
  id: string,
  warWeekId: string,
  dbOrTx: DBOrTx,
): Promise<MutationResult | null> {
  const [found] = await dbOrTx
    .select({ generatedByBracket: pointsEntry.generatedByBracket })
    .from(pointsEntry)
    .where(inWarWeek(id, warWeekId, dbOrTx));
  return found?.generatedByBracket ? { ok: false, error: FROM_BRACKET } : null;
}

/**
 * A hand-entered Points Entry of this War Week, for a write. The write
 * repeats the generated check, so an entry a Bracket took over between the
 * check and the write is left alone.
 */
function handEnteredInWarWeek(id: string, warWeekId: string, dbOrTx: DBOrTx) {
  return and(
    inWarWeek(id, warWeekId, dbOrTx),
    eq(pointsEntry.generatedByBracket, false),
  );
}

/** Why a write changed no row: the entry is generated now, or gone. */
async function missedRefusal(
  id: string,
  warWeekId: string,
  dbOrTx: DBOrTx,
): Promise<MutationResult> {
  return (
    (await generatedRefusal(id, warWeekId, dbOrTx)) ?? {
      ok: false,
      error: NOT_FOUND,
    }
  );
}

export async function createPointsEntry(
  input: PointsEntryValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    // A scoring change takes the same lock (`updateCompetition`), so an
    // entry can't slip in between its entry count and its write.
    await locked(tx, competition, input.competitionId, ctx);
    const resolved = await resolveColumns(input, ctx.warWeekId, tx);
    if (!resolved.ok) return resolved;

    await tx
      .insert(pointsEntry)
      .values({ ...resolved.columns, enteredByEmail: ctx.actorEmail });
    return { ok: true };
  });
}

/**
 * Edits a Points Entry of this War Week. Its entered-by email and time stay
 * as they were; `updated_at` records the edit. Locks the entry's current
 * and posted Competitions first (in id order, so two edits can't deadlock),
 * as a scoring change on either would otherwise miss the move.
 */
export async function updatePointsEntry(
  id: string,
  input: PointsEntryValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const [current] = await tx
      .select({ competitionId: pointsEntry.competitionId })
      .from(pointsEntry)
      .where(inWarWeek(id, ctx.warWeekId, tx));
    if (!current) return { ok: false, error: NOT_FOUND };
    const competitionIds = [
      ...new Set([current.competitionId, input.competitionId]),
    ].sort();
    for (const competitionId of competitionIds) {
      await locked(tx, competition, competitionId, ctx);
    }

    const generated = await generatedRefusal(id, ctx.warWeekId, tx);
    if (generated) return generated;
    const resolved = await resolveColumns(input, ctx.warWeekId, tx);
    if (!resolved.ok) return resolved;

    const updated = await tx
      .update(pointsEntry)
      // The database clock, like `created_at`, so the two compare exactly.
      .set({ ...resolved.columns, updatedAt: sql`now()` })
      .where(handEnteredInWarWeek(id, ctx.warWeekId, tx))
      .returning({ id: pointsEntry.id });
    return updated.length > 0
      ? { ok: true }
      : missedRefusal(id, ctx.warWeekId, tx);
  });
}

export async function deletePointsEntry(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const generated = await generatedRefusal(id, ctx.warWeekId, dbOrTx);
  if (generated) return generated;
  const deleted = await dbOrTx
    .delete(pointsEntry)
    .where(handEnteredInWarWeek(id, ctx.warWeekId, dbOrTx))
    .returning({ id: pointsEntry.id });
  return deleted.length > 0
    ? { ok: true }
    : missedRefusal(id, ctx.warWeekId, dbOrTx);
}
