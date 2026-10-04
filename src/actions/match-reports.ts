"use server";

import type { MatchResultActionResult } from "@/actions/brackets";
import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorizeMatchReport } from "@/auth/authorize";
import { parseMatchResultInput } from "@/lib/bracket/input";
import * as mutations from "@/mutations/match-reports";

/**
 * A linked Participant reports their own Match's result (ADR 0005). Checks
 * who's asking and the Match's facts first, so a refusal wins over malformed
 * input; the mutation checks the facts again under the Competition's lock.
 */
export async function reportMatchResult(
  competitionId: string,
  matchId: string,
  input: unknown,
): Promise<MatchResultActionResult> {
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
