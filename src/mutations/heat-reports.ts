import { eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition } from "@/db/schema";
import {
  bracketRefusal,
  lockedCompetition,
  refuse,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";

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
