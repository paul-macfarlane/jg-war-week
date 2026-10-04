"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import { parseMatchResultInput, parseSquadInput } from "@/lib/bracket/input";
import { isUuid } from "@/lib/uuid";
import * as mutations from "@/mutations/brackets";
import { closeCompetition, reopenCompetition } from "@/mutations/close";
import type { MutationContext, MutationResult } from "@/mutations/types";

export type BracketActionResult = MutationResult;

// Not imported from the mutations: a "use server" module's tests mock them.
const SQUAD_NOT_FOUND = "That Squad no longer exists.";

export type MatchResultActionResult = MutationResult;

/**
 * Runs a Bracket write as an Organizer or a Host of the Competition, in the
 * Competition's own War Week (loaded from the row, never from client
 * input), then revalidates the War Week's pages. `write` parses its input.
 */
async function bracketWrite<R extends { ok: boolean }>(
  action: WarWeekAction,
  competitionId: unknown,
  write: (competitionId: string, ctx: MutationContext) => Promise<R>,
): Promise<R | { ok: false; error: string }> {
  return guarded(async () => {
    const authorized = await authorize(action, "competition", competitionId);
    if (!authorized.ok) return authorized;

    const result = await write(competitionId as string, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function recordMatchResult(
  competitionId: string,
  matchId: string,
  input: unknown,
): Promise<MatchResultActionResult> {
  return bracketWrite(
    "bracket.match-result",
    competitionId,
    async (id, ctx) => {
      if (!isUuid(matchId)) {
        return { ok: false, error: "That Match no longer exists." };
      }
      const parsed = parseMatchResultInput(input);
      if (!parsed.ok) return parsed;
      return mutations.recordMatchResult(id, matchId, parsed.value, ctx);
    },
  );
}

/** Clears a Match's result, as an Organizer or a Host of the Competition. */
export async function clearMatchResult(
  competitionId: string,
  matchId: string,
): Promise<MatchResultActionResult> {
  return bracketWrite(
    "bracket.match-result",
    competitionId,
    async (id, ctx) => {
      if (!isUuid(matchId)) {
        return { ok: false, error: "That Match no longer exists." };
      }
      return mutations.clearMatchResult(id, matchId, ctx);
    },
  );
}

export async function closeBracket(
  competitionId: string,
): Promise<BracketActionResult> {
  return bracketWrite("bracket.close", competitionId, closeCompetition);
}

export async function reopenBracket(
  competitionId: string,
): Promise<BracketActionResult> {
  return bracketWrite("bracket.reopen", competitionId, reopenCompetition);
}

/**
 * Adds a Squad to a team Bracket. JSON, not `FormData` (decision 13): the
 * form closes over its Participant list; refusals carry `fieldErrors` for
 * `name`, `teamId` and `participantIds`.
 */
export async function createSquad(
  competitionId: string,
  input: unknown,
): Promise<BracketActionResult> {
  return bracketWrite("bracket.squads", competitionId, async (id, ctx) => {
    const parsed = parseSquadInput(input);
    if (!parsed.ok) return parsed;
    return mutations.createSquad(id, parsed.value, ctx);
  });
}

/** Edits a Squad of this Competition; its input is `createSquad`'s. */
export async function updateSquad(
  competitionId: string,
  squadId: string,
  input: unknown,
): Promise<BracketActionResult> {
  return bracketWrite("bracket.squads", competitionId, async (id, ctx) => {
    if (!isUuid(squadId)) return { ok: false, error: SQUAD_NOT_FOUND };
    const parsed = parseSquadInput(input);
    if (!parsed.ok) return parsed;
    return mutations.updateSquad(id, squadId, parsed.value, ctx);
  });
}

/** Deletes a Squad that isn't an Entrant. */
export async function deleteSquad(
  competitionId: string,
  squadId: string,
): Promise<BracketActionResult> {
  return bracketWrite("bracket.squads", competitionId, async (id, ctx) => {
    if (!isUuid(squadId)) return { ok: false, error: SQUAD_NOT_FOUND };
    return mutations.deleteSquad(id, squadId, ctx);
  });
}
