"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorizeMatchReport } from "@/auth/authorize";
import { parseMatchResultInput } from "@/lib/bracket/input";
import * as mutations from "@/mutations/match-reports";
import type { MutationResult } from "@/mutations/types";

/**
 * A linked Participant records (or changes) their own Match's result (spec
 * R21, decision 4; D1d). Checks
 * who's asking and the Match's facts first, so a refusal wins over malformed
 * input; the mutation checks the facts again under the Competition's lock.
 */
export async function reportMatchResult(
  competitionId: string,
  matchId: string,
  input: unknown,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeMatchReport(competitionId, matchId);
    if (!authorized.ok) return authorized;
    const parsed = parseMatchResultInput(input);
    if (!parsed.ok) return parsed;
    const result = await mutations.submitMatchReport(
      competitionId,
      matchId,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/**
 * A linked Participant clears their own Match's result (spec R21, S4),
 * under the same rule as recording it.
 */
export async function clearMatchReport(
  competitionId: string,
  matchId: string,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorizeMatchReport(competitionId, matchId);
    if (!authorized.ok) return authorized;
    const result = await mutations.clearMatchReport(
      competitionId,
      matchId,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
