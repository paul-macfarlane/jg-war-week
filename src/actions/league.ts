"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize, authorizeLeagueRecord } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import { parseSwapInput } from "@/lib/league/input";
import { parseLeagueResult } from "@/lib/league/result";
import { closeCompetition, reopenCompetition } from "@/mutations/close";
import * as league from "@/mutations/league";
import type { MutationContext, MutationResult } from "@/mutations/types";

export type LeagueActionResult = MutationResult;

/**
 * Runs a League write as an Organizer or a Host of the Competition, in the
 * Competition's own War Week (loaded from the row, never from client
 * input), then revalidates the War Week's pages. `write` parses its input
 * after the authorize step (ADR 0003).
 */
async function runWrite(
  action: WarWeekAction,
  competitionId: unknown,
  write: (
    competitionId: string,
    ctx: MutationContext,
  ) => Promise<MutationResult>,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorize(action, "competition", competitionId);
    if (!authorized.ok) return authorized;
    const result = await write(competitionId as string, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** "Pair rounds" (round robin) or "Pair round 1" (Swiss). */
export async function pairLeague(
  competitionId: string,
): Promise<LeagueActionResult> {
  return runWrite("league.pair", competitionId, (id, ctx) =>
    league.pairLeague(id, {}, ctx),
  );
}

/** "Pair next round" (Swiss). */
export async function pairNextRound(
  competitionId: string,
): Promise<LeagueActionResult> {
  return runWrite("league.pair", competitionId, (id, ctx) =>
    league.pairNextRound(id, ctx),
  );
}

/** Edit pairings: swaps two Entrants within a round. `input` is `{ round, x, y }`. */
export async function swapPairing(
  competitionId: string,
  input: unknown,
): Promise<LeagueActionResult> {
  return runWrite("league.pair", competitionId, async (id, ctx) => {
    const parsed = parseSwapInput(input);
    if (!parsed.ok) return parsed;
    return league.swapPairing(id, parsed.value, ctx);
  });
}

/** "Clear pairings": deletes every Match while none has a result. */
export async function clearPairings(
  competitionId: string,
): Promise<LeagueActionResult> {
  return runWrite("league.pair", competitionId, (id, ctx) =>
    league.clearPairings(id, ctx),
  );
}

/**
 * Records (or changes) a Match's result: a Host or Organizer any Match;
 * with self-report on, a player in it or anyone on a player Team. `input`
 * is `{ result: "a" | "b" | "draw" | "", scoreA?, scoreB? }`; with a Score
 * direction and both Scores, the Scores decide.
 */
export async function recordLeagueResult(
  competitionId: string,
  matchId: string,
  input: unknown,
): Promise<LeagueActionResult> {
  return guarded(async () => {
    const authorized = await authorizeLeagueRecord(
      "league.record",
      competitionId,
      matchId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseLeagueResult(
      authorized.competition.scoreDirection,
      input,
    );
    if (!parsed.ok) return parsed;
    const result = await league.recordLeagueResult(
      competitionId,
      matchId,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Clears a Match's result: whoever could record it. */
export async function clearLeagueResult(
  competitionId: string,
  matchId: string,
): Promise<LeagueActionResult> {
  return guarded(async () => {
    const authorized = await authorizeLeagueRecord(
      "league.clear",
      competitionId,
      matchId,
    );
    if (!authorized.ok) return authorized;
    const result = await league.clearLeagueResult(
      competitionId,
      matchId,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Closes a League for its Placement Points: refused until complete. */
export async function closeLeague(
  competitionId: string,
): Promise<LeagueActionResult> {
  return runWrite("results.close", competitionId, closeCompetition);
}

/** Reopens a closed League, withdrawing its generated Points Entries. */
export async function reopenLeague(
  competitionId: string,
): Promise<LeagueActionResult> {
  return runWrite("results.reopen", competitionId, reopenCompetition);
}
