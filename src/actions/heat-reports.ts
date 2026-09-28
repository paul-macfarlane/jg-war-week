"use server";

import type { HeatResultActionResult } from "@/actions/brackets";
import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize, authorizeHeatReport } from "@/auth/authorize";
import { parseHeatResultInput } from "@/lib/bracket/input";
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

/**
 * A linked Participant reports their own Heat's result (ADR 0005). Checks
 * who's asking and the Heat's facts first, so a refusal wins over malformed
 * input; the mutation checks the facts again under the Competition's lock.
 */
export async function reportHeatResult(
  competitionId: string,
  heatId: string,
  input: unknown,
): Promise<HeatResultActionResult> {
  return guarded(async () => {
    const authorized = await authorizeHeatReport(competitionId, heatId);
    if (!authorized.ok) return authorized;
    const parsed = parseHeatResultInput(input);
    if (!parsed.ok) return parsed;
    const result = await mutations.submitHeatReport(
      competitionId,
      heatId,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
