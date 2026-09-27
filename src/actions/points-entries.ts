"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize, postedCompetitionId } from "@/auth/authorize";
import {
  type PointsEntryInput,
  parsePointsEntryInput,
} from "@/lib/points-entry";
import * as mutations from "@/mutations/points-entries";
import type { MutationResult } from "@/mutations/types";

export type PointsEntryActionResult = MutationResult;

/** Adds a Points Entry in the posted Competition's War Week. */
export async function createPointsEntry(
  input: PointsEntryInput,
): Promise<PointsEntryActionResult> {
  return guarded(async () => {
    const competitionId = postedCompetitionId(input);
    const authorized = await authorize(
      "points-entry.create",
      "competition",
      competitionId,
      { postedCompetitionId: competitionId, notFound: "Choose a Competition." },
    );
    if (!authorized.ok) return authorized;
    const parsed = parsePointsEntryInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.createPointsEntry(
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** A Host needs both the entry's current and its posted Competition. */
export async function updatePointsEntry(
  id: string,
  input: PointsEntryInput,
): Promise<PointsEntryActionResult> {
  return guarded(async () => {
    const authorized = await authorize("points-entry.edit", "pointsEntry", id, {
      postedCompetitionId: postedCompetitionId(input),
    });
    if (!authorized.ok) return authorized;
    const parsed = parsePointsEntryInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.updatePointsEntry(
      id,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function deletePointsEntry(
  id: string,
): Promise<PointsEntryActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "points-entry.delete",
      "pointsEntry",
      id,
    );
    if (!authorized.ok) return authorized;

    const result = await mutations.deletePointsEntry(id, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
