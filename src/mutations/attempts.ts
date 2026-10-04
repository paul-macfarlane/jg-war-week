import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { attempt, participant } from "@/db/schema";
import type { AttemptInput } from "@/lib/best-score/input";
import {
  ATTEMPT_MISSING,
  NOT_LINKED,
  attemptChangeError,
  attemptLogError,
} from "@/lib/best-score/log-rule";
import { refuse } from "@/mutations/brackets";
import { lockedLogged } from "@/mutations/logged-results";
import type { MutationContext, MutationResult } from "@/mutations/types";
import {
  type AttemptLogFacts,
  getAttemptLogFacts,
} from "@/queries/logged-results";

export const NOT_BEST_SCORE = "This Competition isn't run as Best score.";
export const NOT_A_WAR_WEEK_PARTICIPANT =
  "Choose a Participant of this War Week.";
export const PARTICIPANT_ON_NO_TEAM =
  "That Participant isn't on a Team, so the Attempt can't count for one.";

/** The Best score Competition locked with its facts reloaded inside the lock. */
async function lockedAttempts(
  tx: DBOrTx,
  competitionId: string,
  attemptId: string | null,
  participantId: string | null,
  ctx: MutationContext,
): Promise<AttemptLogFacts | string> {
  const found = await lockedLogged(tx, competitionId, ctx);
  if (typeof found === "string") return found;
  if (found.format !== "best-score") return NOT_BEST_SCORE;
  const facts = await getAttemptLogFacts(
    competitionId,
    attemptId,
    ctx.actorEmail,
    participantId,
    tx,
  );
  return facts ?? NOT_BEST_SCORE;
}

/**
 * The Team an Attempt by `participantId` counts for, frozen at logging
 * (spec R21, P9): their Team now. A refusal when they aren't a
 * Participant of this War Week, or, in team scoring, are on no Team.
 */
async function creditOf(
  tx: DBOrTx,
  facts: AttemptLogFacts,
  participantId: string,
  ctx: MutationContext,
): Promise<{ teamId: string | null } | string> {
  const [found] = await tx
    .select({ teamId: participant.teamId })
    .from(participant)
    .where(
      and(
        eq(participant.id, participantId),
        eq(participant.warWeekId, ctx.warWeekId),
      ),
    )
    .limit(1);
  if (!found) return NOT_A_WAR_WEEK_PARTICIPANT;
  if (facts.competition.scoring === "team" && found.teamId === null) {
    return PARTICIPANT_ON_NO_TEAM;
  }
  return { teamId: found.teamId };
}

/**
 * Logs a Best score Attempt (ADR 0006): a linked Participant as
 * themselves, or a Host or Organizer for any Participant. Under the
 * Competition's row lock the facts are checked again (so a log after Close
 * is refused); the Attempt counts for the Participant's Team at logging.
 */
export async function logAttempt(
  competitionId: string,
  input: AttemptInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<{ ok: true; resultId: string } | { ok: false; error: string }> {
  return dbOrTx.transaction(async (tx) => {
    const facts = await lockedAttempts(
      tx,
      competitionId,
      null,
      input.participantId,
      ctx,
    );
    if (typeof facts === "string") return refuse(facts);
    const refusal = attemptLogError(facts.attemptLog);
    if (refusal) return refuse(refusal);
    if (!facts.attemptLog.runs && !facts.linked) return refuse(NOT_LINKED);
    const credit = await creditOf(tx, facts, input.participantId, ctx);
    if (typeof credit === "string") return refuse(credit);

    const [row] = await tx
      .insert(attempt)
      .values({
        competitionId,
        participantId: input.participantId,
        teamId: credit.teamId,
        score: input.score,
        loggedByEmail: ctx.actorEmail,
        loggedByParticipantId: facts.attemptLog.runs
          ? null
          : facts.linked!.participantId,
      })
      .returning({ id: attempt.id });
    return { ok: true, resultId: row.id };
  });
}

/**
 * Changes an Attempt (ADR 0006): its logger, or a Host or Organizer,
 * checked again under the lock. A new Participant's Team is credited as
 * at logging; its recorded time never changes.
 */
export async function updateAttempt(
  competitionId: string,
  attemptId: string,
  input: AttemptInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedAttempts(
      tx,
      competitionId,
      attemptId,
      input.participantId,
      ctx,
    );
    if (typeof facts === "string") return refuse(facts);
    const refusal = attemptChangeError(facts.attemptLog);
    if (refusal) return refuse(refusal);
    const existing = facts.attemptLog.attempt;
    if (!existing || existing === "missing") return refuse(ATTEMPT_MISSING);
    const moved = existing.participantId !== input.participantId;
    const credit = moved
      ? await creditOf(tx, facts, input.participantId, ctx)
      : null;
    if (typeof credit === "string") return refuse(credit);

    await tx
      .update(attempt)
      .set({
        score: input.score,
        ...(credit
          ? { participantId: input.participantId, teamId: credit.teamId }
          : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(attempt.id, attemptId));
    return { ok: true };
  });
}

/** Deletes an Attempt: its logger, or a Host or Organizer. */
export async function deleteAttempt(
  competitionId: string,
  attemptId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedAttempts(tx, competitionId, attemptId, null, ctx);
    if (typeof facts === "string") return refuse(facts);
    const refusal = attemptChangeError(facts.attemptLog);
    if (refusal) return refuse(refusal);
    if (facts.attemptLog.attempt === "missing") return refuse(ATTEMPT_MISSING);
    await tx
      .delete(attempt)
      .where(
        and(
          eq(attempt.id, attemptId),
          eq(attempt.competitionId, competitionId),
        ),
      );
    return { ok: true };
  });
}
