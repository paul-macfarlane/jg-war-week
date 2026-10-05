import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  participant,
  participation,
  pointsEntry,
} from "@/db/schema";
import { isBracketFormat } from "@/lib/bracket/view";
import { isLoggedFormat } from "@/lib/enums";
import {
  type PlacingsNow,
  bracketPlacingsNow,
  loggedPlacingsNow,
  participationPlacingsNow,
  placementPlacingsNow,
} from "@/lib/placings-now";
import { generatedNote } from "@/lib/points-entry";
import {
  type BracketRun,
  COMPETITION_NOT_FOUND,
  bracketOf,
  deleteGenerated,
  refuse,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getBracketEntrants } from "@/queries/brackets";
import { getLoggedStandings } from "@/queries/logged-results";
import { getPlacementRows } from "@/queries/placements";

/** The Competition, locked, with everything any Format's Close reads. */
async function lockedForClose(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
) {
  const [found] = await tx
    .select({
      id: competition.id,
      name: competition.name,
      warWeekId: competition.warWeekId,
      scoring: competition.scoring,
      format: competition.format,
      bracketConfig: competition.bracketConfig,
      placementPoints: competition.placementPoints,
      participationPoints: competition.participationPoints,
      closedAt: competition.closedAt,
      selfEnroll: competition.selfEnroll,
      entrantLimit: competition.entrantLimit,
    })
    .from(competition)
    .where(
      and(
        eq(competition.id, competitionId),
        eq(competition.warWeekId, ctx.warWeekId),
      ),
    )
    .for("update");
  return found;
}

type ClosingCompetition = NonNullable<
  Awaited<ReturnType<typeof lockedForClose>>
>;

/** The Points this Competition's results give now, by Format. */
async function placingsNow(
  tx: DBOrTx,
  found: ClosingCompetition,
): Promise<PlacingsNow> {
  if (found.format === "placement") {
    return placementPlacingsNow(await getPlacementRows(found, tx), found);
  }
  if (found.format === "participation") {
    const tookPart = await tx
      .select({
        participantId: participation.participantId,
        teamId: participant.teamId,
      })
      .from(participation)
      .innerJoin(participant, eq(participant.id, participation.participantId))
      .where(eq(participation.competitionId, found.id));
    return participationPlacingsNow(tookPart, found);
  }
  if (isLoggedFormat(found.format)) {
    return loggedPlacingsNow(await getLoggedStandings(found.id, tx), found);
  }
  if (found.format === "league") {
    // R23: S2 closes a League by its standings (`leaguePlacingsNow`).
    return { ok: false, error: COMPETITION_NOT_FOUND };
  }
  if (isBracketFormat(found.format)) {
    const bracket = await bracketOf(tx, found as BracketRun);
    const entrants = await getBracketEntrants(found.id, tx);
    return bracketPlacingsNow(
      bracket,
      entrants.map((e) => ({ ...e, pointsTeamId: e.pointsTeamId })),
      found,
    );
  }
  return { ok: false, error: COMPETITION_NOT_FOUND };
}

/**
 * Closes a Competition of any Format the same way: replaces its generated
 * Points Entries with what its results give now (`placingsNow`, each
 * Format's own pure rule), noted "From <format>", and marks it Closed.
 * Closing again rewrites the generated entries from the current results
 * and keeps the first Close's `closed_at`. A Format that isn't ready
 * (a Bracket with Matches to play, a Placement sheet with a Score and no
 * Place) refuses and writes nothing.
 */
export async function closeCompetition(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedForClose(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    const now = await placingsNow(tx, found);
    if (!now.ok) return refuse(now.error);

    await deleteGenerated(tx, competitionId);
    if (now.points.length) {
      await tx.insert(pointsEntry).values(
        now.points.map(({ teamId, participantId, points }) => ({
          warWeekId: ctx.warWeekId,
          competitionId,
          teamId,
          participantId,
          points,
          note: generatedNote(found.format),
          enteredByEmail: ctx.actorEmail,
          generated: true,
        })),
      );
    }
    await tx
      .update(competition)
      .set({
        closedAt: sql`coalesce(${competition.closedAt}, now())`,
        updatedAt: sql`now()`,
      })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Reopens a Competition of any Format: deletes its generated Points
 * Entries (never a typed one) and clears `closed_at`. Reopening an open
 * Competition changes nothing.
 */
export async function reopenCompetition(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedForClose(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    await deleteGenerated(tx, competitionId);
    await tx
      .update(competition)
      .set({ closedAt: null, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}
