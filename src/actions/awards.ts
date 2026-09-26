"use server";

import { revalidatePath } from "next/cache";

import { authorize } from "@/auth/authorize";
import { type AwardInput, parseAwardInput } from "@/lib/awards";
import * as mutations from "@/mutations/awards";
import type { MutationResult } from "@/mutations/types";

export type AwardActionResult = MutationResult;

function revalidateWarWeek(edition: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/${edition}`, "layout");
  // A complete War Week's Awards also show in the Archive.
  revalidatePath("/history", "layout");
}

/** Gives an Award in the War Week the form was rendered for. */
export async function createAward(
  warWeekId: string,
  input: AwardInput,
): Promise<AwardActionResult> {
  const authorized = await authorize("award.create", "warWeek", warWeekId);
  if (!authorized.ok) return authorized;
  const parsed = parseAwardInput(input);
  if (!parsed.ok) return parsed;

  const result = await mutations.createAward(parsed.value, authorized.ctx);
  if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
  return result;
}

export async function updateAward(
  id: string,
  input: AwardInput,
): Promise<AwardActionResult> {
  const authorized = await authorize("award.edit", "award", id);
  if (!authorized.ok) return authorized;
  const parsed = parseAwardInput(input);
  if (!parsed.ok) return parsed;

  const result = await mutations.updateAward(id, parsed.value, authorized.ctx);
  if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
  return result;
}

export async function deleteAward(id: string): Promise<AwardActionResult> {
  const authorized = await authorize("award.delete", "award", id);
  if (!authorized.ok) return authorized;

  const result = await mutations.deleteAward(id, authorized.ctx);
  if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
  return result;
}
