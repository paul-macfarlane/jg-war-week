"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import { parseSelfReportInput } from "@/lib/bracket/self-report";
import * as mutations from "@/mutations/heat-reports";
import type { MutationResult } from "@/mutations/types";

/**
 * Turns self-report on or off for a Bracket, as an Organizer or the
 * Competition's Host; `input` is `{ on }`, parsed only after authorize.
 */
export async function setSelfReport(
  competitionId: string,
  input: unknown,
): Promise<MutationResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "competition.self-report",
      "competition",
      competitionId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseSelfReportInput(input);
    if (!parsed.ok) return parsed;
    const result = await mutations.setSelfReport(
      competitionId,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
