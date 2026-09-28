import { eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition } from "@/db/schema";
import { NOT_LINKED, heatReportError } from "@/lib/bracket/heat-report-rule";
import type { HeatResult } from "@/lib/bracket/types";
import {
  COMPETITION_NOT_FOUND,
  bracketRefusal,
  lockedCompetition,
  refuse,
  writeHeatResult,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getHeatReportFacts } from "@/queries/heat-reports";

/**
 * Turns self-report on or off for a Bracket (ADR 0005). Takes the
 * Competition's row lock, so a report in flight runs before or after it and
 * its in-lock re-check sees the new setting. Allowed while finalized (it
 * changes no Heat); results already reported stand when it's turned off.
 */
export async function setSelfReport(
  competitionId: string,
  { on }: { on: boolean },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found, { allowFinalized: true });
    if (refusal) return refuse(refusal);
    await tx
      .update(competition)
      .set({ selfReport: on, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * A linked Participant's own Heat Result (ADR 0005): under the
 * Competition's row lock, reloads the Heat facts and checks them again (so
 * of two racing reports the second sees the Heat decided, and a report
 * after self-report is turned off is refused), then writes it through the
 * same core as a Host's result, recording the reporter on that Heat.
 */
export async function submitHeatReport(
  competitionId: string,
  heatId: string,
  result: HeatResult,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<
  { ok: true; resetHeatIds: string[] } | { ok: false; error: string }
> {
  return dbOrTx.transaction(async (tx) => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    const { heatReport, linked } = await getHeatReportFacts(
      competitionId,
      heatId,
      ctx.actorEmail,
      tx,
    );
    const refusal = heatReportError(heatReport);
    if (refusal || !linked) return refuse(refusal ?? NOT_LINKED);
    return writeHeatResult(tx, found, heatId, result, {
      email: ctx.actorEmail,
      participantId: linked.participantId,
    });
  });
}
