import { and, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  attempt,
  bracketMatch,
  entrant,
  participation,
  placement,
  pointsEntry,
  seriesMatch,
} from "@/db/schema";
import { hasResults } from "@/lib/bracket/formats";
import { isBracketFormat } from "@/lib/bracket/view";
import {
  type CompetitionLockFacts,
  type CompetitionResults,
  lockFactsOf,
} from "@/lib/competition-locks";
import { loadBracket } from "@/queries/brackets";

/** What a Competition has entered so far (`hasResult` reads it). */
export async function getCompetitionResults(
  found: Pick<Competition, "id" | "format" | "bracketConfig">,
  dbOrTx: DBOrTx = db,
): Promise<CompetitionResults> {
  const id = found.id;
  const matches = await dbOrTx.$count(
    bracketMatch,
    eq(bracketMatch.competitionId, id),
  );
  return {
    entrants: await dbOrTx.$count(entrant, eq(entrant.competitionId, id)),
    logged:
      (await dbOrTx.$count(seriesMatch, eq(seriesMatch.competitionId, id))) +
      (await dbOrTx.$count(attempt, eq(attempt.competitionId, id))),
    placements: await dbOrTx.$count(placement, eq(placement.competitionId, id)),
    checkIns: await dbOrTx.$count(
      participation,
      eq(participation.competitionId, id),
    ),
    matches,
    matchResult:
      matches > 0 &&
      isBracketFormat(found.format) &&
      hasResults(await loadBracket(id, dbOrTx, found)),
    generatedPointsEntries: await dbOrTx.$count(
      pointsEntry,
      and(eq(pointsEntry.competitionId, id), eq(pointsEntry.generated, true)),
    ),
  };
}

/** What the lock rules (`settingLockReason`) read about this Competition. */
export async function getCompetitionLockFacts(
  found: Pick<Competition, "id" | "format" | "bracketConfig" | "closedAt">,
  dbOrTx: DBOrTx = db,
): Promise<CompetitionLockFacts> {
  return lockFactsOf(await getCompetitionResults(found, dbOrTx), found);
}
