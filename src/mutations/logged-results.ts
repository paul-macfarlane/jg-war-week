import { eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, pointsEntry } from "@/db/schema";
import { pointsFor } from "@/lib/bracket/points";
import { type LoggedFormat, isLoggedFormat } from "@/lib/enums";
import { NOT_LOGGED_FORMAT, placingsOf } from "@/lib/logged-results";
import { generatedNote } from "@/lib/points-entry";
import {
  type BracketCompetition,
  COMPETITION_NOT_FOUND,
  deleteGenerated,
  lockedCompetition,
  refuse,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getLoggedStandings, sideOf } from "@/queries/logged-results";

export const ALREADY_CLOSED = "This Competition is already closed.";

export type LoggedRun = BracketCompetition & { format: LoggedFormat };

/**
 * Locks a Head-to-head or Best score Competition of this War Week for a
 * write; a refusal when it's gone or another Format.
 */
export async function lockedLogged(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
): Promise<LoggedRun | string> {
  const found = await lockedCompetition(tx, competitionId, ctx);
  if (!found) return COMPETITION_NOT_FOUND;
  if (!isLoggedFormat(found.format)) return NOT_LOGGED_FORMAT;
  return found as LoggedRun;
}

/**
 * Closes a Head-to-head or Best score Competition: its standings' places
 * become Placement Points Entries (`pointsFor`, ties sharing a place's
 * points, as when closing a Bracket), marked generated and noted "From
 * head-to-head" or "From best score", to the Team or the Participant by
 * scoring; then no Match or Attempt changes until Reopen.
 */
export async function closeLoggedResults(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedLogged(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.closedAt) return refuse(ALREADY_CLOSED);

    const rows = await getLoggedStandings(competitionId, tx);
    const awarded = pointsFor(placingsOf(rows), found);
    await deleteGenerated(tx, competitionId);
    if (awarded.length) {
      await tx.insert(pointsEntry).values(
        awarded.map(({ entrantId, points }) => ({
          warWeekId: ctx.warWeekId,
          competitionId,
          ...sideOf(found.scoring, entrantId),
          points,
          note: generatedNote(found.format),
          enteredByEmail: ctx.actorEmail,
          generated: true,
        })),
      );
    }
    await tx
      .update(competition)
      .set({ closedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Reopens a closed Head-to-head or Best score Competition: deletes its
 * generated Points Entries and clears `closed_at`.
 */
export async function reopenLoggedResults(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedLogged(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    await deleteGenerated(tx, competitionId);
    await tx
      .update(competition)
      .set({ closedAt: null, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}
