"use server";

import { revalidatePath } from "next/cache";

import { guarded } from "@/actions/result";
import { authorize, postedCompetitionId } from "@/auth/authorize";
import {
  type PointsEntryInput,
  parsePointsEntryInput,
} from "@/lib/points-entry";
import * as mutations from "@/mutations/points-entries";

export type PointsEntryActionResult =
  { ok: true } | { ok: false; error: string };

function revalidateWarWeek(edition: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/${edition}`, "layout");
}

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
