"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import type { WarWeekAction } from "@/lib/access";
import {
  parsePlacementIdInput,
  parsePlacementTargetInput,
  parseSavePlacementsInput,
} from "@/lib/placement/input";
import { closeCompetition, reopenCompetition } from "@/mutations/close";
import * as mutations from "@/mutations/placements";
import type { MutationContext, MutationResult } from "@/mutations/types";

/**
 * Runs an Organizer or Host write on a Placement Competition's sheet, in
 * its own War Week (loaded from the row, ADR 0003), then revalidates the
 * War Week's pages. `write` parses its input, after authorize.
 */
async function placementWrite(
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

/** Adds a row; `input` is `{ teamId }` or `{ participantId }`. */
export async function addPlacement(
  competitionId: string,
  input: unknown,
): Promise<MutationResult> {
  return placementWrite("placement.edit", competitionId, async (id, ctx) => {
    const parsed = parsePlacementTargetInput(input);
    if (!parsed.ok) return parsed;
    return mutations.addPlacement(id, parsed.value, ctx);
  });
}

/** Removes a row; `input` is `{ placementId }`. */
export async function removePlacement(
  competitionId: string,
  input: unknown,
): Promise<MutationResult> {
  return placementWrite("placement.edit", competitionId, async (id, ctx) => {
    const parsed = parsePlacementIdInput(input);
    if (!parsed.ok) return parsed;
    return mutations.removePlacement(id, parsed.value.placementId, ctx);
  });
}

/** Saves the sheet: the Score direction and each row's Place and Score. */
export async function savePlacements(
  competitionId: string,
  input: unknown,
): Promise<MutationResult> {
  return placementWrite("placement.edit", competitionId, async (id, ctx) => {
    const parsed = parseSavePlacementsInput(input);
    if (!parsed.ok) return parsed;
    return mutations.savePlacements(id, parsed.value, ctx);
  });
}

/** Closes the sheet into generated Points Entries. */
export async function closePlacements(
  competitionId: string,
): Promise<MutationResult> {
  return placementWrite("placement.close", competitionId, (id, ctx) =>
    closeCompetition(id, ctx),
  );
}

/** Reopens a Closed sheet, withdrawing its points. */
export async function reopenPlacements(
  competitionId: string,
): Promise<MutationResult> {
  return placementWrite("placement.reopen", competitionId, (id, ctx) =>
    reopenCompetition(id, ctx),
  );
}
