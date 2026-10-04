import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { award, awardParticipant } from "@/db/schema";
import type { AwardValues } from "@/lib/awards";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { recipientsInWarWeek } from "@/queries/awards";

const NOT_FOUND = "That Award no longer exists.";

/** Only Awards of this War Week, by id. */
function inWarWeek(id: string, warWeekId: string) {
  return and(eq(award.id, id), eq(award.warWeekId, warWeekId));
}

/** Refuses a Team or Participant that isn't in this War Week. */
async function recipientsError(
  values: AwardValues,
  warWeekId: string,
  dbOrTx: DBOrTx,
): Promise<string | null> {
  const found = await recipientsInWarWeek(warWeekId, values, dbOrTx);
  if (!found.team) return "Choose a Team of this War Week.";
  if (!found.participants) return "Choose Participants of this War Week.";
  return null;
}

async function insertRecipients(
  awardId: string,
  participantIds: string[],
  dbOrTx: DBOrTx,
) {
  if (participantIds.length === 0) return;
  await dbOrTx
    .insert(awardParticipant)
    .values(
      participantIds.map((participantId) => ({ awardId, participantId })),
    );
}

export async function createAward(
  values: AwardValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const refusal = await recipientsError(values, ctx.warWeekId, tx);
    if (refusal) return { ok: false, error: refusal };

    const [created] = await tx
      .insert(award)
      .values({
        warWeekId: ctx.warWeekId,
        name: values.name,
        description: values.description,
        teamId: values.teamId,
      })
      .returning({ id: award.id });
    await insertRecipients(created.id, values.participantIds, tx);
    return { ok: true };
  });
}

/** Edits an Award of this War Week, replacing its Participant recipients. */
export async function updateAward(
  id: string,
  values: AwardValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const refusal = await recipientsError(values, ctx.warWeekId, tx);
    if (refusal) return { ok: false, error: refusal };

    const updated = await tx
      .update(award)
      .set({
        name: values.name,
        description: values.description,
        teamId: values.teamId,
        updatedAt: sql`now()`,
      })
      .where(inWarWeek(id, ctx.warWeekId))
      .returning({ id: award.id });
    if (updated.length === 0) return { ok: false, error: NOT_FOUND };

    await tx.delete(awardParticipant).where(eq(awardParticipant.awardId, id));
    await insertRecipients(id, values.participantIds, tx);
    return { ok: true };
  });
}

export async function deleteAward(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const deleted = await dbOrTx
    .delete(award)
    .where(inWarWeek(id, ctx.warWeekId))
    .returning({ id: award.id });
  return deleted.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}
