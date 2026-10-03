"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import {
  type DiscretionaryInput,
  parseDiscretionaryInput,
} from "@/lib/discretionary-points";
import * as mutations from "@/mutations/discretionary-points";
import type { MutationResult } from "@/mutations/types";

export type DiscretionaryActionResult = MutationResult;

/** Gives Discretionary points in the War Week the page was rendered for. */
export async function createDiscretionaryPoints(
  warWeekId: string,
  input: DiscretionaryInput,
): Promise<DiscretionaryActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "discretionary.create",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseDiscretionaryInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.createDiscretionaryPoints(
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function updateDiscretionaryPoints(
  id: string,
  input: DiscretionaryInput,
): Promise<DiscretionaryActionResult> {
  return guarded(async () => {
    const authorized = await authorize("discretionary.edit", "pointsEntry", id);
    if (!authorized.ok) return authorized;
    const parsed = parseDiscretionaryInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.updateDiscretionaryPoints(
      id,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function deleteDiscretionaryPoints(
  id: string,
): Promise<DiscretionaryActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "discretionary.delete",
      "pointsEntry",
      id,
    );
    if (!authorized.ok) return authorized;

    const result = await mutations.deleteDiscretionaryPoints(
      id,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
