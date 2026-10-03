import { and, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  competition,
  entrant,
  game,
  heat,
  participation,
  placement,
  pointsEntry,
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
  const heats = await dbOrTx.$count(heat, eq(heat.competitionId, id));
  return {
    entrants: await dbOrTx.$count(entrant, eq(entrant.competitionId, id)),
    games: await dbOrTx.$count(game, eq(game.competitionId, id)),
    placements: await dbOrTx.$count(placement, eq(placement.competitionId, id)),
    checkIns: await dbOrTx.$count(
      participation,
      eq(participation.competitionId, id),
    ),
    heats,
    heatResult:
      heats > 0 &&
      isBracketFormat(found.format) &&
      hasResults(await loadBracket(id, dbOrTx, found)),
    generatedPointsEntries: await dbOrTx.$count(
      pointsEntry,
      and(
        eq(pointsEntry.competitionId, id),
        eq(pointsEntry.generatedByBracket, true),
      ),
    ),
  };
}

/** What the lock rules (`settingLockReason`) read about this Competition. */
export async function getCompetitionLockFacts(
  found: Pick<Competition, "id" | "format" | "bracketConfig" | "finalizedAt">,
  dbOrTx: DBOrTx = db,
): Promise<CompetitionLockFacts> {
  return lockFactsOf(
    await getCompetitionResults(found, dbOrTx),
    found.finalizedAt,
  );
}

/** The lock facts of a Competition by id, or undefined when there's none. */
export async function getCompetitionLockFactsById(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<CompetitionLockFacts | undefined> {
  const [found] = await dbOrTx
    .select({
      id: competition.id,
      format: competition.format,
      bracketConfig: competition.bracketConfig,
      finalizedAt: competition.finalizedAt,
    })
    .from(competition)
    .where(eq(competition.id, competitionId));
  return found && getCompetitionLockFacts(found, dbOrTx);
}
