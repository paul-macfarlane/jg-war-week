import { and, eq, inArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
  participant,
  placement,
  pointsEntry,
  team,
} from "@/db/schema";
import {
  type PlacementTarget,
  type SavePlacementsValues,
} from "@/lib/placement/input";
import {
  finalizePlacementError,
  placementEntryValues,
} from "@/lib/placement/score";
import {
  COMPETITION_NOT_FOUND,
  deleteGenerated,
  refuse,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getPlacementRows } from "@/queries/placements";

export const NOT_PLACEMENT = "This Competition isn't run as Placement.";
/** Any row change (add, Add everyone, remove, save) while the sheet is Finalized. */
export const PLACEMENT_FINALIZED = "Reopen the Competition first.";
export const PLACEMENT_MISSING = "That Placement no longer exists.";
const PARTICIPANT_MISSING = "That Participant no longer exists.";
const TEAM_MISSING = "That Team no longer exists.";
const TEAM_TAKES_TEAMS = "A team Competition takes Teams, not Participants.";
const INDIVIDUAL_TAKES_PARTICIPANTS =
  "An individual Competition takes Participants, not Teams.";

type LockedPlacement = Pick<
  Competition,
  "id" | "warWeekId" | "scoring" | "placementPoints" | "finalizedAt"
>;

/**
 * Locks a Placement Competition of this War Week (ADR 0003), so sheet
 * writes, Finalize and Reopen run one after the other. A string when
 * there's no such Competition or it isn't run as Placement.
 */
async function lockedPlacement(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
): Promise<LockedPlacement | string> {
  const [found] = await tx
    .select({
      id: competition.id,
      warWeekId: competition.warWeekId,
      format: competition.format,
      scoring: competition.scoring,
      placementPoints: competition.placementPoints,
      finalizedAt: competition.finalizedAt,
    })
    .from(competition)
    .where(
      and(
        eq(competition.id, competitionId),
        eq(competition.warWeekId, ctx.warWeekId),
      ),
    )
    .for("update");
  if (!found) return COMPETITION_NOT_FOUND;
  if (found.format !== "placement") return NOT_PLACEMENT;
  return found;
}

/**
 * Runs a row change: the Competition locked, a Placement one, and not
 * Finalized (Reopen first).
 */
function rowWrite(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx,
  write: (tx: DBOrTx, found: LockedPlacement) => Promise<MutationResult>,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedPlacement(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.finalizedAt) return refuse(PLACEMENT_FINALIZED);
    return write(tx, found);
  });
}

/**
 * Adds a Team (team scoring) or a Participant (individual) of the
 * Competition's War Week to its sheet, unplaced. Someone already on it
 * changes nothing.
 */
export async function addPlacement(
  competitionId: string,
  target: PlacementTarget,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return rowWrite(competitionId, ctx, dbOrTx, async (tx, found) => {
    if ("teamId" in target) {
      if (found.scoring !== "team") {
        return refuse(INDIVIDUAL_TAKES_PARTICIPANTS);
      }
      const [row] = await tx
        .select({ id: team.id })
        .from(team)
        .where(
          and(eq(team.id, target.teamId), eq(team.warWeekId, ctx.warWeekId)),
        );
      if (!row) return refuse(TEAM_MISSING);
    } else {
      if (found.scoring !== "individual") return refuse(TEAM_TAKES_TEAMS);
      const [row] = await tx
        .select({ id: participant.id })
        .from(participant)
        .where(
          and(
            eq(participant.id, target.participantId),
            eq(participant.warWeekId, ctx.warWeekId),
          ),
        );
      if (!row) return refuse(PARTICIPANT_MISSING);
    }
    await tx
      .insert(placement)
      .values({ competitionId, ...target })
      .onConflictDoNothing();
    return { ok: true };
  });
}

/**
 * Add everyone: every Team of the War Week (team scoring) or its whole
 * roster (individual) not on the sheet yet, unplaced.
 */
export async function addEveryone(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return rowWrite(competitionId, ctx, dbOrTx, async (tx, found) => {
    const values =
      found.scoring === "team"
        ? (
            await tx
              .select({ id: team.id })
              .from(team)
              .where(eq(team.warWeekId, ctx.warWeekId))
          ).map(({ id }) => ({ competitionId, teamId: id }))
        : (
            await tx
              .select({ id: participant.id })
              .from(participant)
              .where(eq(participant.warWeekId, ctx.warWeekId))
          ).map(({ id }) => ({ competitionId, participantId: id }));
    if (values.length) {
      await tx.insert(placement).values(values).onConflictDoNothing();
    }
    return { ok: true };
  });
}

/** Removes a row from the sheet. */
export async function removePlacement(
  competitionId: string,
  placementId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return rowWrite(competitionId, ctx, dbOrTx, async (tx) => {
    const deleted = await tx
      .delete(placement)
      .where(
        and(
          eq(placement.id, placementId),
          eq(placement.competitionId, competitionId),
        ),
      )
      .returning({ id: placement.id });
    return deleted.length ? { ok: true } : refuse(PLACEMENT_MISSING);
  });
}

/**
 * Saves the sheet: the Score direction and each listed row's Place and
 * Score (rows not listed keep theirs). A row of another Competition
 * refuses the whole save. A Score without a Place is allowed until
 * Finalize.
 */
export async function savePlacements(
  competitionId: string,
  values: SavePlacementsValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return rowWrite(competitionId, ctx, dbOrTx, async (tx) => {
    const ids = values.rows.map((row) => row.id);
    if (ids.length) {
      const own = await tx
        .select({ id: placement.id })
        .from(placement)
        .where(
          and(
            eq(placement.competitionId, competitionId),
            inArray(placement.id, ids),
          ),
        );
      if (own.length !== new Set(ids).size) return refuse(PLACEMENT_MISSING);
    }
    for (const row of values.rows) {
      await tx
        .update(placement)
        .set({ place: row.place, score: row.score, updatedAt: sql`now()` })
        .where(eq(placement.id, row.id));
    }
    await tx
      .update(competition)
      .set({ scoreDirection: values.scoreDirection, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Finalizes the sheet: replaces its generated Points Entries with each
 * Place's Placement Points and marks it Finalized. Finalizing again
 * rewrites the generated Points Entries from the current rows and keeps
 * the first Finalize's `finalized_at`. Refused while a row has a Score and
 * no Place, or nobody is placed.
 */
export async function finalizePlacements(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedPlacement(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const rows = await getPlacementRows(found, tx);
    const refusal = finalizePlacementError(rows);
    if (refusal) return refuse(refusal);

    await deleteGenerated(tx, competitionId);
    const values = placementEntryValues(rows, found, {
      actorEmail: ctx.actorEmail,
    });
    if (values.length) await tx.insert(pointsEntry).values(values);
    await tx
      .update(competition)
      .set({
        finalizedAt: sql`coalesce(${competition.finalizedAt}, now())`,
        updatedAt: sql`now()`,
      })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Reopens the sheet: deletes its generated Points Entries (hand-entered
 * ones stay) and clears `finalized_at`. Reopening an open sheet changes
 * nothing.
 */
export async function reopenPlacements(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedPlacement(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    await deleteGenerated(tx, competitionId);
    await tx
      .update(competition)
      .set({ finalizedAt: null, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}
