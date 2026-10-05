import { and, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { pointsEntry } from "@/db/schema";
import type { EntryPoints } from "@/lib/results-table";

/**
 * A Competition's generated Points Entries (the ones its Close wrote,
 * `generated`) as target and points (no note, no email): what a
 * Closed Competition's results table shows as its points.
 */
export async function getCompetitionEntryPoints(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<EntryPoints[]> {
  return dbOrTx
    .select({
      teamId: pointsEntry.teamId,
      participantId: pointsEntry.participantId,
      points: pointsEntry.points,
    })
    .from(pointsEntry)
    .where(
      and(
        eq(pointsEntry.competitionId, competitionId),
        eq(pointsEntry.generated, true),
      ),
    );
}
