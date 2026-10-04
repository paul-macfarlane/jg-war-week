import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  participant,
  participation,
  pointsEntry,
  warWeek,
} from "@/db/schema";
import {
  NOT_LINKED,
  NOT_PARTICIPATION,
  checkInError,
  checkOutError,
  markError,
} from "@/lib/participation/check-in-rule";
import type { ParticipationSettings } from "@/lib/participation/input";
import { scoreParticipation } from "@/lib/participation/score";
import { generatedNote } from "@/lib/points-entry";
import {
  COMPETITION_NOT_FOUND,
  GAMES_CLOSED,
  deleteGenerated,
  refuse,
} from "@/mutations/brackets";
import { ALREADY_CLOSED } from "@/mutations/games";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getCheckInFacts } from "@/queries/participation";

const PARTICIPANT_MISSING = "That Participant no longer exists.";
const INDIVIDUAL_NO_PLACEMENT_POINTS =
  "An individual Competition gives points to each Participant, not Placement Points.";
const TEAM_NO_POINTS_PER_PARTICIPANT =
  "A team Competition awards Placement Points, not points per Participant.";
const POINTS_PER_PARTICIPANT_REQUIRED = "Enter the points per Participant.";
const PLACEMENT_POINTS_REQUIRED = "Enter the Placement Points.";

/**
 * Locks a `participation` Competition of this War Week, so a mark, a
 * check-in, a settings save and Close run one after the other. Reads its
 * own columns (not `lockedCompetition`'s Bracket set) and the War Week's
 * Team Label. A string when there's no such `participation` Competition.
 */
async function lockedParticipation(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
) {
  const [found] = await tx
    .select({
      id: competition.id,
      format: competition.format,
      scoring: competition.scoring,
      placementPoints: competition.placementPoints,
      participationPoints: competition.participationPoints,
      closedAt: competition.closedAt,
      teamLabel: warWeek.teamLabel,
    })
    .from(competition)
    .innerJoin(warWeek, eq(warWeek.id, competition.warWeekId))
    .where(
      and(
        eq(competition.id, competitionId),
        eq(competition.warWeekId, ctx.warWeekId),
      ),
    )
    .for("update", { of: competition });
  if (!found) return COMPETITION_NOT_FOUND;
  if (found.format !== "participation") return NOT_PARTICIPATION;
  return found;
}

/**
 * Saves a `participation` Competition's settings: N when individual, its
 * Placement Points when team (ranked by headcount), and Self check-in with
 * its close time. Refused while closed.
 */
export async function setParticipationSettings(
  competitionId: string,
  input: ParticipationSettings,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedParticipation(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.closedAt) return refuse(GAMES_CLOSED);
    const individual = found.scoring === "individual";
    if (individual) {
      if (input.placementPoints) return refuse(INDIVIDUAL_NO_PLACEMENT_POINTS);
      if (input.participationPoints === null) {
        return refuse(POINTS_PER_PARTICIPANT_REQUIRED);
      }
    } else {
      if (input.participationPoints !== null) {
        return refuse(TEAM_NO_POINTS_PER_PARTICIPANT);
      }
      if (!input.placementPoints) return refuse(PLACEMENT_POINTS_REQUIRED);
    }
    await tx
      .update(competition)
      .set({
        participationPoints: individual ? input.participationPoints : null,
        placementPoints: individual ? null : input.placementPoints,
        selfCheckIn: input.selfCheckIn,
        checkInClosesAt: input.checkInClosesAt,
        updatedAt: sql`now()`,
      })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * The Host or an Organizer ticks a Participant of this War Week as having
 * taken part (on a Team, in team scoring). Ticking someone already in,
 * checked in or not, changes nothing. Refused while closed.
 */
export async function markParticipant(
  competitionId: string,
  participantId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedParticipation(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.closedAt) return refuse(GAMES_CLOSED);
    const [who] = await tx
      .select({ teamId: participant.teamId })
      .from(participant)
      .where(
        and(
          eq(participant.id, participantId),
          eq(participant.warWeekId, ctx.warWeekId),
        ),
      );
    if (!who) return refuse(PARTICIPANT_MISSING);
    const notMarkable = markError({
      scoring: found.scoring,
      teamId: who.teamId,
      teamLabel: found.teamLabel,
    });
    if (notMarkable) return refuse(notMarkable);
    await tx
      .insert(participation)
      .values({
        competitionId,
        participantId,
        markedByEmail: ctx.actorEmail,
        checkedIn: false,
      })
      .onConflictDoNothing();
    return { ok: true };
  });
}

/** The Host or an Organizer unticks anyone, a check-in included. Refused while closed. */
export async function unmarkParticipant(
  competitionId: string,
  participantId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedParticipation(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.closedAt) return refuse(GAMES_CLOSED);
    await tx
      .delete(participation)
      .where(
        and(
          eq(participation.competitionId, competitionId),
          eq(participation.participantId, participantId),
        ),
      );
    return { ok: true };
  });
}

/** The Competition locked, then the check-in facts reloaded inside the lock. */
async function lockedFacts(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
) {
  const found = await lockedParticipation(tx, competitionId, ctx);
  if (typeof found === "string") return refuse(found);
  const facts = await getCheckInFacts(competitionId, ctx.actorEmail, tx);
  return { ok: true as const, ...facts };
}

/**
 * A linked Participant checks themselves in (ADR 0009), under the
 * Competition's row lock with the facts checked again there.
 */
export async function checkIn(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedFacts(tx, competitionId, ctx);
    if (!facts.ok) return facts;
    const refusal = checkInError(facts.checkIn);
    if (refusal || !facts.linked) return refuse(refusal ?? NOT_LINKED);
    await tx.insert(participation).values({
      competitionId,
      participantId: facts.linked.participantId,
      markedByEmail: ctx.actorEmail,
      checkedIn: true,
    });
    return { ok: true };
  });
}

/** A linked Participant removes their own check-in (never the Host's mark). */
export async function checkOut(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedFacts(tx, competitionId, ctx);
    if (!facts.ok) return facts;
    const refusal = checkOutError(facts.checkIn);
    if (refusal || !facts.linked) return refuse(refusal ?? NOT_LINKED);
    await tx
      .delete(participation)
      .where(
        and(
          eq(participation.competitionId, competitionId),
          eq(participation.participantId, facts.linked.participantId),
          eq(participation.checkedIn, true),
        ),
      );
    return { ok: true };
  });
}

/**
 * Closes a `participation` Competition: who took part becomes Points
 * Entries (`scoreParticipation`, each Participant's Team as it is now),
 * marked generated and noted "From participation"; then no marks or
 * check-ins until Reopen. Nobody marked closes with no entries.
 */
export async function closeParticipation(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedParticipation(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    if (found.closedAt) return refuse(ALREADY_CLOSED);

    const tookPart = await tx
      .select({
        participantId: participation.participantId,
        teamId: participant.teamId,
      })
      .from(participation)
      .innerJoin(participant, eq(participant.id, participation.participantId))
      .where(eq(participation.competitionId, competitionId));
    const scored = scoreParticipation(tookPart, found);
    await deleteGenerated(tx, competitionId);
    if (scored.length) {
      await tx.insert(pointsEntry).values(
        scored.map(({ teamId, participantId, points }) => ({
          warWeekId: ctx.warWeekId,
          competitionId,
          teamId,
          participantId,
          points,
          note: generatedNote("participation"),
          enteredByEmail: ctx.actorEmail,
          generated: true,
        })),
      );
    }
    await tx
      .update(competition)
      .set({ closedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * Reopens a `participation` Competition: deletes its generated Points
 * Entries and clears `closed_at`.
 */
export async function reopenParticipation(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedParticipation(tx, competitionId, ctx);
    if (typeof found === "string") return refuse(found);
    await deleteGenerated(tx, competitionId);
    await tx
      .update(competition)
      .set({ closedAt: null, updatedAt: sql`now()` })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}
