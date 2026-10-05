import { and, eq, inArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
  participant,
  placement,
  team,
} from "@/db/schema";
import {
  type PlacementTarget,
  type SavePlacementsValues,
} from "@/lib/placement/input";
import { COMPETITION_NOT_FOUND, refuse } from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";

export const NOT_PLACEMENT = "This Competition isn't run as Placement.";
/** Any row change (add, remove, save) while the sheet is Closed. */
export const PLACEMENT_CLOSED = "Reopen the Competition first.";
export const PLACEMENT_MISSING = "That Placement no longer exists.";
const PARTICIPANT_MISSING = "That Participant no longer exists.";
const TEAM_MISSING = "That Team no longer exists.";
const TEAM_TAKES_TEAMS = "A team Competition takes Teams, not Participants.";
const INDIVIDUAL_TAKES_PARTICIPANTS =
  "An individual Competition takes Participants, not Teams.";

type LockedPlacement = Pick<
  Competition,
  "id" | "warWeekId" | "scoring" | "placementPoints" | "closedAt"
>;

/**
 * Locks a Placement Competition of this War Week (ADR 0003), so sheet
 * writes, Close and Reopen run one after the other. A string when
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
      closedAt: competition.closedAt,
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
 * Closed (Reopen first).
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
    if (found.closedAt) return refuse(PLACEMENT_CLOSED);
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
 * Saves the sheet: each listed row's Place and Score (rows not listed keep
 * theirs). Never the Score direction: it saves as its own setting, locked
 * once the Competition has a result. A row of another Competition
 * refuses the whole save. A Score without a Place is allowed until
 * Close.
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
    return { ok: true };
  });
}
