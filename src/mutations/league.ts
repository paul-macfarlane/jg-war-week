/**
 * A League's writes (spec R23, decisions 5, 6, 8; readings R2, R3, R7–R9;
 * execution plan P3a, P4): pairing rounds, swapping two Entrants within a
 * round, clearing every pairing, and recording or clearing a Match's
 * result. Each runs in one transaction under the Competition's row lock
 * (`FOR UPDATE`), scoped by the Competition id and the War Week, and a
 * Match by its id within that Competition; the facts are reloaded and the
 * rule checked again inside the lock. Close and Reopen are the shared
 * `src/mutations/close.ts`.
 */
import { and, asc, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, entrant, leagueMatch } from "@/db/schema";
import { shuffleSeedPositions } from "@/lib/bracket/seeding";
import type { ScoreDirection } from "@/lib/enums";
import { type LeagueConfig, leagueConfigOf } from "@/lib/league/config";
import type { SwapInput } from "@/lib/league/input";
import {
  type LeagueEntrant,
  type LeagueMatchFacts,
  type Pairing,
  roundRobin,
  swap,
  swissRound,
} from "@/lib/league/pairing";
import type { LeagueResultInput } from "@/lib/league/result";
import {
  MATCH_MISSING,
  NOT_LINKED,
  clearPairingsError,
  leagueRecordError,
  pairError,
  pairNextError,
  swapError,
} from "@/lib/league/rules";
import { COMPETITION_NOT_FOUND, refuse } from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getLeagueRecordFacts } from "@/queries/league";

export const NOT_A_LEAGUE = "This Competition isn't run as a League.";
export const NO_RESULT_TO_CLEAR = "That Match has no result.";

/** The League locked for a write, with what the rules read. */
type LockedLeague = {
  id: string;
  closed: boolean;
  config: LeagueConfig;
  scoreDirection: ScoreDirection;
};

/**
 * Locks a League of this War Week (`FOR UPDATE`), so two writes to it run
 * one after the other. A refusal string when it's gone, of another War
 * Week, or another Format.
 */
async function lockedLeague(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
): Promise<LockedLeague | string> {
  const [found] = await tx
    .select({
      id: competition.id,
      format: competition.format,
      leagueConfig: competition.leagueConfig,
      scoreDirection: competition.scoreDirection,
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
  if (found.format !== "league") return NOT_A_LEAGUE;
  return {
    id: found.id,
    closed: found.closedAt !== null,
    config: leagueConfigOf(found),
    scoreDirection: found.scoreDirection,
  };
}

/** The League's Entrants at their Seed Positions. */
function entrantsOf(tx: DBOrTx, competitionId: string) {
  return tx
    .select({ id: entrant.id, seedPosition: entrant.seedPosition })
    .from(entrant)
    .where(eq(entrant.competitionId, competitionId))
    .orderBy(asc(entrant.seedPosition));
}

/** The League's Matches in round and position order. */
function matchesOf(
  tx: DBOrTx,
  competitionId: string,
): Promise<(LeagueMatchFacts & { id: string; position: number })[]> {
  return tx
    .select({
      id: leagueMatch.id,
      round: leagueMatch.round,
      position: leagueMatch.position,
      a: leagueMatch.entrantAId,
      b: leagueMatch.entrantBId,
      result: leagueMatch.result,
    })
    .from(leagueMatch)
    .where(eq(leagueMatch.competitionId, competitionId))
    .orderBy(asc(leagueMatch.round), asc(leagueMatch.position));
}

/** Saves a round's pairings as Matches, in order. */
async function insertRound(
  tx: DBOrTx,
  competitionId: string,
  round: number,
  pairings: Pairing[],
) {
  if (pairings.length === 0) return;
  await tx.insert(leagueMatch).values(
    pairings.map(({ a, b }, position) => ({
      competitionId,
      round,
      position,
      entrantAId: a,
      entrantBId: b,
    })),
  );
}

/**
 * "Pair rounds" (round robin) or "Pair round 1" (Swiss) (reading R3):
 * draws the Seed Positions at random (by `rng`), then pairs every round of
 * a round robin by the circle method, or a Swiss League's round 1 by Seed
 * Position. Refused once paired, with fewer than 2 Entrants, a Swiss
 * League's rounds out of range, or while Closed (`pairError`).
 */
export async function pairLeague(
  competitionId: string,
  options: { rng?: () => number },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedLeague(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const [entrants, matches] = await Promise.all([
      entrantsOf(tx, competitionId),
      matchesOf(tx, competitionId),
    ]);
    const refusal = pairError({
      closed: found.closed,
      config: found.config,
      entrantCount: entrants.length,
      matches,
    });
    if (refusal) return refuse(refusal);

    const seeded = shuffleSeedPositions(
      entrants.map((e) => e.id),
      options.rng ?? Math.random,
    );
    // Seed Positions are unique per Competition: move them aside first.
    await tx
      .update(entrant)
      .set({ seedPosition: sql`-${entrant.seedPosition}` })
      .where(eq(entrant.competitionId, competitionId));
    for (const { entrantId, seedPosition } of seeded) {
      await tx
        .update(entrant)
        .set({ seedPosition })
        .where(eq(entrant.id, entrantId));
    }
    const league: LeagueEntrant[] = seeded.map(
      ({ entrantId, seedPosition }) => ({ id: entrantId, seedPosition }),
    );

    if (found.config.pairing === "round-robin") {
      for (const { round, matches: pairings } of roundRobin(league)) {
        await insertRound(tx, competitionId, round, pairings);
      }
      return { ok: true };
    }
    const first = swissRound({ entrants: league, matches: [] });
    if (!first.ok) return refuse(first.error);
    await insertRound(tx, competitionId, 1, first.matches);
    return { ok: true };
  });
}

/**
 * "Pair next round" (Swiss, decision 6): once every Match of the latest
 * round has a result (a bye never needs one), pairs the next round by
 * score groups with no rematch (`swissRound`). Refused on a round robin,
 * before round 1, with every round paired, or while Closed
 * (`pairNextError`), and when every pairing would repeat a Match.
 */
export async function pairNextRound(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedLeague(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const [entrants, matches] = await Promise.all([
      entrantsOf(tx, competitionId),
      matchesOf(tx, competitionId),
    ]);
    const refusal = pairNextError({
      closed: found.closed,
      config: found.config,
      entrantCount: entrants.length,
      matches,
    });
    if (refusal) return refuse(refusal);
    const next = swissRound({ entrants, matches });
    if (!next.ok) return refuse(next.error);
    const latest = Math.max(...matches.map((m) => m.round));
    await insertRound(tx, competitionId, latest + 1, next.matches);
    return { ok: true };
  });
}

/**
 * Edit pairings (reading R7): swaps Entrants `x` and `y` within `round`;
 * each Match keeps its place, and either may be the bye or sit-out.
 * Refused while Closed, for two not both in the round or already in one
 * Match, once any Match of a Swiss round has a result, and once a round
 * robin Match the swap touches has one (`swapError`). A round robin swap
 * that repeats a pairing is allowed (Paul, Q4): the dialog warns.
 */
export async function swapPairing(
  competitionId: string,
  { round, x, y }: SwapInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedLeague(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const inRound = (await matchesOf(tx, competitionId)).filter(
      (m) => m.round === round,
    );
    const refusal = swapError({
      closed: found.closed,
      pairing: found.config.pairing,
      round: inRound,
      x,
      y,
    });
    if (refusal) return refuse(refusal);
    const swapped = swap(inRound, x, y);
    for (const [i, match] of inRound.entries()) {
      const next = swapped[i];
      if (next.a === match.a && next.b === match.b) continue;
      await tx
        .update(leagueMatch)
        .set({ entrantAId: next.a, entrantBId: next.b, updatedAt: sql`now()` })
        .where(
          and(
            eq(leagueMatch.id, match.id),
            eq(leagueMatch.competitionId, competitionId),
          ),
        );
    }
    return { ok: true };
  });
}

/**
 * "Clear pairings" (reading R9): deletes every Match while none has a
 * result, which unlocks the Pairing, rounds, Score direction and Entrants.
 * Refused while Closed, with nothing paired, or once a Match has a result
 * (`clearPairingsError`).
 */
export async function clearPairings(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedLeague(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    const refusal = clearPairingsError({
      closed: found.closed,
      matches: await matchesOf(tx, competitionId),
    });
    if (refusal) return refuse(refusal);
    await tx
      .delete(leagueMatch)
      .where(eq(leagueMatch.competitionId, competitionId));
    return { ok: true };
  });
}

/**
 * The League locked and a Match's write rule checked again inside the
 * lock (decision 8): a Host or Organizer any Match; with self-report on,
 * a player in it (or anyone on a player Team). Returns who records it: the
 * linked Participant, or null for a Host or Organizer.
 */
async function recordable(
  tx: DBOrTx,
  competitionId: string,
  matchId: string,
  ctx: MutationContext,
): Promise<
  | { ok: true; recordedBy: string | null; hasResult: boolean }
  | { ok: false; error: string }
> {
  const found = await lockedLeague(tx, competitionId, ctx);
  if (typeof found === "string") return refuse(found);
  const facts = await getLeagueRecordFacts(
    competitionId,
    matchId,
    ctx.actorEmail,
    tx,
  );
  if (!facts) return refuse(NOT_A_LEAGUE);
  const refusal = leagueRecordError(facts.leagueRecord);
  if (refusal) return refuse(refusal);
  if (!facts.match) return refuse(MATCH_MISSING);
  if (!facts.leagueRecord.runs && !facts.linked) return refuse(NOT_LINKED);
  return {
    ok: true,
    recordedBy: facts.leagueRecord.runs ? null : facts.linked!.participantId,
    hasResult: facts.match.result !== null,
  };
}

/**
 * Records (or changes) a Match's result and optional Scores (decision 3;
 * reading R2: the action parsed them with the Score direction, which is
 * locked once paired). Sets when and by whom: the email for audit, and
 * the linked Participant (null for a Host or Organizer).
 */
export async function recordLeagueResult(
  competitionId: string,
  matchId: string,
  input: LeagueResultInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const allowed = await recordable(tx, competitionId, matchId, ctx);
    if (!allowed.ok) return allowed;
    await tx
      .update(leagueMatch)
      .set({
        result: input.result,
        scoreA: input.scoreA,
        scoreB: input.scoreB,
        recordedAt: sql`now()`,
        recordedByEmail: ctx.actorEmail,
        recordedByParticipantId: allowed.recordedBy,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(leagueMatch.id, matchId),
          eq(leagueMatch.competitionId, competitionId),
        ),
      );
    return { ok: true };
  });
}

/**
 * Clears a Match's result and Scores, by whoever could record it, while
 * the League is open. Pairings already made after it stand (reading R8).
 */
export async function clearLeagueResult(
  competitionId: string,
  matchId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const allowed = await recordable(tx, competitionId, matchId, ctx);
    if (!allowed.ok) return allowed;
    if (!allowed.hasResult) return refuse(NO_RESULT_TO_CLEAR);
    await tx
      .update(leagueMatch)
      .set({
        result: null,
        scoreA: null,
        scoreB: null,
        recordedAt: null,
        recordedByEmail: null,
        recordedByParticipantId: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(leagueMatch.id, matchId),
          eq(leagueMatch.competitionId, competitionId),
        ),
      );
    return { ok: true };
  });
}
