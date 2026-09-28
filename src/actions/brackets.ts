"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import { parseHeatScheduleInput } from "@/lib/bracket/heat-schedule";
import {
  parseEntrantsInput,
  parseFormatInput,
  parseGenerateInput,
  parseHeatResultInput,
  parseSquadInput,
} from "@/lib/bracket/input";
import { isUuid } from "@/lib/uuid";
import * as mutations from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";

export type BracketActionResult = MutationResult;

// Not imported from the mutations: a "use server" module's tests mock them.
const SQUAD_NOT_FOUND = "That Squad no longer exists.";

export type HeatResultActionResult =
  { ok: true; resetHeatIds: string[] } | { ok: false; error: string };

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

/** Part of the Competition's setup. */
export async function setCompetitionFormat(
  competitionId: string,
  input: unknown,
): Promise<BracketActionResult> {
  return bracketWrite("competition.edit", competitionId, async (id, ctx) => {
    const parsed = parseFormatInput(input);
    if (!parsed.ok) return parsed;
    return mutations.setCompetitionFormat(id, parsed.value, ctx);
  });
}

/** Sets the Entrants in Seed Position order; `force` clears Heat Results. */
export async function replaceEntrants(
  competitionId: string,
  input: unknown,
): Promise<BracketActionResult> {
  return bracketWrite("bracket.entrants", competitionId, async (id, ctx) => {
    const parsed = parseEntrantsInput(input);
    if (!parsed.ok) return parsed;
    return mutations.replaceEntrants(id, parsed.value, ctx);
  });
}

/** Sets random Seed Positions and (re)builds the Bracket; `force` clears Heat Results. */
export async function generateBracket(
  competitionId: string,
  input: unknown = {},
): Promise<BracketActionResult> {
  return bracketWrite("bracket.generate", competitionId, async (id, ctx) => {
    const parsed = parseGenerateInput(input);
    if (!parsed.ok) return parsed;
    return mutations.generateBracket(
      id,
      { force: parsed.value.force, seeding: parsed.value.seeding },
      ctx,
    );
  });
}

export async function recordHeatResult(
  competitionId: string,
  heatId: string,
  input: unknown,
): Promise<HeatResultActionResult> {
  return bracketWrite("bracket.heat-result", competitionId, async (id, ctx) => {
    if (!isUuid(heatId)) {
      return { ok: false, error: "That Heat no longer exists." };
    }
    const parsed = parseHeatResultInput(input);
    if (!parsed.ok) return parsed;
    return mutations.recordHeatResult(id, heatId, parsed.value, ctx);
  });
}

/**
 * Sets, or clears, a Heat's time and place from the results screen. Posts
 * `FormData` through `useActionState` (ADR 0004): `prevState` and
 * `formData` are the two arguments React's action passes after the two
 * bound ones.
 */
export async function setHeatSchedule(
  competitionId: string,
  heatId: string,
  _prevState: BracketActionResult | null,
  formData: FormData,
): Promise<BracketActionResult> {
  return bracketWrite(
    "bracket.heat-schedule",
    competitionId,
    async (id, ctx) => {
      if (!isUuid(heatId)) {
        return { ok: false, error: "That Heat no longer exists." };
      }
      const parsed = parseHeatScheduleInput(formData);
      if (!parsed.ok) return parsed;
      return mutations.setHeatSchedule(id, heatId, parsed.value, ctx);
    },
  );
}

export async function finalizeBracket(
  competitionId: string,
): Promise<BracketActionResult> {
  return bracketWrite(
    "bracket.finalize",
    competitionId,
    mutations.finalizeBracket,
  );
}

export async function unfinalizeBracket(
  competitionId: string,
): Promise<BracketActionResult> {
  return bracketWrite(
    "bracket.unfinalize",
    competitionId,
    mutations.unfinalizeBracket,
  );
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
