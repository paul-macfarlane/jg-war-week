import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { DBOrTx, db } from "@/db";
import { competition } from "@/db/schema";
import type { RoundDefaults } from "@/lib/bracket/config";
import {
  moveEntrant,
  setMatchAdvance as setAdvance,
  setRoundDefaults as setDefaults,
} from "@/lib/bracket/groups";
import { type Bracket, BracketError, type Entrant } from "@/lib/bracket/types";
import {
  MATCH_NOT_FOUND,
  NOT_A_BRACKET,
  bracketOf,
  bracketRefusal,
  isBracketRun,
  lockedCompetition,
  refuse,
  replaceRoundsFrom,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getBracketEntrants } from "@/queries/brackets";

/** An edit before Generate: there are no Matches to edit. */
export const GENERATE_FIRST = "Generate the Bracket first.";

/**
 * Runs one Group Bracket tree edit (spec R21, decision 11) under the
 * Competition's row lock: refuses a Competition that can't change (closed,
 * not a Bracket) and a Bracket not yet generated, runs `edit` on the pure
 * Bracket (its refusals, a Round with a result among them, come back as
 * the error), then saves the edited Round and every later one
 * (`replaceRoundsFrom`) and any change to the Round defaults, all in one
 * transaction.
 */
async function editBracket(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx,
  edit: (
    bracket: Bracket,
    entrants: () => Promise<Entrant[]>,
  ) => Promise<{ next: Bracket; round: number } | { error: string }>,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found);
    if (refusal || !isBracketRun(found)) {
      return refuse(refusal ?? NOT_A_BRACKET);
    }
    const bracket = await bracketOf(tx, found);
    if (bracket.matches.length === 0) return refuse(GENERATE_FIRST);
    let edited: { next: Bracket; round: number } | { error: string };
    try {
      edited = await edit(bracket, async () =>
        (await getBracketEntrants(competitionId, tx)).map((e) => ({
          id: e.id,
          seedPosition: e.seedPosition,
          label: "",
        })),
      );
    } catch (error) {
      if (error instanceof BracketError) return refuse(error.message);
      throw error;
    }
    if ("error" in edited) return refuse(edited.error);
    const { next, round } = edited;
    if (JSON.stringify(next.config) !== JSON.stringify(bracket.config)) {
      await tx
        .update(competition)
        .set({ bracketConfig: next.config, updatedAt: sql`now()` })
        .where(eq(competition.id, competitionId));
    }
    await replaceRoundsFrom(tx, competitionId, next, round);
    return { ok: true };
  });
}

/** The Round of a Match of this Bracket, or null when it isn't one. */
function roundOfMatch(bracket: Bracket, matchId: string): number | null {
  return bracket.matches.find((h) => h.id === matchId)?.round ?? null;
}

const newId = () => randomUUID();

/**
 * Sets how many of a Group Match advance (1 to its size), re-planning
 * every later Round. Refused once its Round has a result.
 */
export function setMatchAdvance(
  competitionId: string,
  matchId: string,
  { advanceCount }: { advanceCount: number },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return editBracket(competitionId, ctx, dbOrTx, async (bracket) => {
    const round = roundOfMatch(bracket, matchId);
    if (round === null) return { error: MATCH_NOT_FOUND };
    return {
      next: setAdvance(bracket, matchId, advanceCount, newId),
      round,
    };
  });
}

/**
 * Moves an Entrant to another Match of the same Round, re-planning every
 * later Round. Refused once the Round has a result.
 */
export function moveMatchEntrant(
  competitionId: string,
  { entrantId, toMatchId }: { entrantId: string; toMatchId: string },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return editBracket(competitionId, ctx, dbOrTx, async (bracket) => {
    const round = roundOfMatch(bracket, toMatchId);
    if (round === null) return { error: MATCH_NOT_FOUND };
    return {
      next: moveEntrant(bracket, entrantId, toMatchId, newId),
      round,
    };
  });
}

/**
 * Sets a Round's defaults (entrants per Match, how many advance), re-dealing
 * it when it's filled and re-planning every later Round. Refused once the
 * Round has a result.
 */
export function setRoundDefaults(
  competitionId: string,
  round: number,
  defaults: RoundDefaults,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return editBracket(competitionId, ctx, dbOrTx, async (bracket, entrants) => ({
    next: setDefaults(bracket, round, defaults, await entrants(), newId),
    round,
  }));
}
