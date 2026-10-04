import { eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition } from "@/db/schema";
import { NOT_LINKED, matchReportError } from "@/lib/bracket/match-report-rule";
import type { MatchResult } from "@/lib/bracket/types";
import {
  COMPETITION_NOT_FOUND,
  bracketRefusal,
  lockedCompetition,
  refuse,
  writeMatchResult,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getMatchReportFacts } from "@/queries/match-reports";

/**
 * Turns self-report on or off for a Bracket (ADR 0005). Takes the
 * Competition's row lock, so a report in flight runs before or after it and
 * its in-lock re-check sees the new setting. Allowed while closed (it
 * changes no Match); results already reported stand when it's turned off.
 */
export async function setSelfReport(
  competitionId: string,
  { on }: { on: boolean },
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    const refusal = bracketRefusal(found, { allowClosed: true });
    if (refusal) return refuse(refusal);
    await tx
      .update(competition)
      .set({ selfReport: on, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * A linked Participant's own Match Result (ADR 0005): under the
 * Competition's row lock, reloads the Match facts and checks them again (so
 * of two racing reports the second sees the Match decided, and a report
 * after self-report is turned off is refused), then writes it through the
 * same core as a Host's result, recording the reporter on that Match.
 */
export async function submitMatchReport(
  competitionId: string,
  matchId: string,
  result: MatchResult,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<
  { ok: true; resetMatchIds: string[] } | { ok: false; error: string }
> {
  return dbOrTx.transaction(async (tx) => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    const { matchReport, linked } = await getMatchReportFacts(
      competitionId,
      matchId,
      ctx.actorEmail,
      tx,
    );
    const refusal = matchReportError(matchReport);
    if (refusal || !linked) return refuse(refusal ?? NOT_LINKED);
    return writeMatchResult(tx, found, matchId, result, {
      email: ctx.actorEmail,
      participantId: linked.participantId,
    });
  });
}
