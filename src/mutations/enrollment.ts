import { and, eq, gt, lt, max, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  entrant,
  participant,
  squad,
  squadParticipant,
  warWeek,
} from "@/db/schema";
import { squadError } from "@/lib/bracket/squads";
import { gamesConfigOf } from "@/lib/games/config";
import {
  ENTRANT_LIMIT_TOO_LOW,
  type SelfEnrollInput,
} from "@/lib/games/enroll-input";
import {
  NOT_LINKED,
  enrollError,
  withdrawError,
} from "@/lib/games/enroll-rule";
import {
  COMPETITION_NOT_FOUND,
  FINALIZED,
  GAMES_CLOSED,
  lockedCompetition,
  refuse,
} from "@/mutations/brackets";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getEnrollFacts } from "@/queries/enrollment";

/** The enroll switch on a points Competition: it has no Entrant list. */
export const POINTS_NO_ENROLL =
  "Participants enroll only in a Bracket or a Games Competition.";
/** The enroll switch on a Best of: the Host sets its two Entrants. */
export const BEST_OF_NO_ENROLL =
  "A Best of is set by the Host; enrollment is off.";
/** The enroll switch on an open-to-everyone `games` Competition. */
export const OPEN_NO_ENROLL =
  "Everyone can play already; there's no list to enroll in.";
export type SelfEnrollValues = SelfEnrollInput;

/**
 * Sets the "Participants can enroll" switch, the Entrant limit and the
 * close time (ADR 0006), under the Competition's row lock so an enrollment
 * in flight runs before or after it. Refused on a points Competition, a
 * finalized (closed) one, and, when turning it on, a Best of or an
 * open-to-everyone `games` Competition (R3 decision 12).
 */
export async function setSelfEnroll(
  competitionId: string,
  { on, entrantLimit, enrollClosesAt }: SelfEnrollValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  if (
    entrantLimit !== null &&
    !(Number.isInteger(entrantLimit) && entrantLimit > 1)
  ) {
    return {
      ok: false,
      error: ENTRANT_LIMIT_TOO_LOW,
      fieldErrors: { entrantLimit: ENTRANT_LIMIT_TOO_LOW },
    };
  }
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const found = await lockedCompetition(tx, competitionId, ctx);
    if (!found) return refuse(COMPETITION_NOT_FOUND);
    if (found.format === "points") return refuse(POINTS_NO_ENROLL);
    if (found.finalizedAt) {
      return refuse(found.format === "games" ? GAMES_CLOSED : FINALIZED);
    }
    if (on && found.format === "games" && found.gameType) {
      if (found.entrantsOpen) return refuse(OPEN_NO_ENROLL);
      if (
        found.gameType === "head-to-head" &&
        gamesConfigOf({
          gameType: found.gameType,
          gameConfig: found.gameConfig,
        }).bestOf !== null
      ) {
        return refuse(BEST_OF_NO_ENROLL);
      }
    }
    await tx
      .update(competition)
      .set({
        selfEnroll: on,
        entrantLimit,
        enrollClosesAt,
        updatedAt: sql`now()`,
      })
      .where(eq(competition.id, competitionId));
    return { ok: true };
  });
}

/**
 * The Competition locked, and the enrollment facts reloaded inside the
 * lock, so two requests racing (for the last place under an Entrant limit,
 * say) run one after the other and the second sees the first's write.
 */
async function lockedFacts(
  tx: DBOrTx,
  competitionId: string,
  ctx: MutationContext,
  squadId?: string,
) {
  const found = await lockedCompetition(tx, competitionId, ctx);
  if (!found) return refuse(COMPETITION_NOT_FOUND);
  const facts = await getEnrollFacts(
    competitionId,
    ctx.actorEmail,
    { squadId },
    tx,
  );
  return { ok: true as const, ...facts };
}

/** The Entrant row a linked Participant enrolls: themselves or their Team. */
function entrantOf(
  scoring: "team" | "individual",
  linked: { participantId: string; teamId: string | null },
) {
  return scoring === "team"
    ? { teamId: linked.teamId!, participantId: null }
    : { teamId: null, participantId: linked.participantId };
}

/**
 * A linked Participant enters themselves (individual scoring) or their Team
 * (team scoring) at the next Seed Position, under the Competition's row
 * lock with the facts checked again there.
 */
export async function enroll(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedFacts(tx, competitionId, ctx);
    if (!facts.ok) return facts;
    const refusal = enrollError(facts.enroll);
    if (refusal || !facts.linked) return refuse(refusal ?? NOT_LINKED);

    const [last] = await tx
      .select({ seed: max(entrant.seedPosition) })
      .from(entrant)
      .where(eq(entrant.competitionId, competitionId));
    await tx.insert(entrant).values({
      competitionId,
      ...entrantOf(facts.enroll.scoring, facts.linked),
      seedPosition: (last?.seed ?? 0) + 1,
    });
    return { ok: true };
  });
}

/**
 * A linked Participant withdraws themselves or their Team before
 * enrollment closes; the Seed Positions after theirs move up one, so they
 * stay 1..n in order.
 */
export async function withdraw(
  competitionId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedFacts(tx, competitionId, ctx);
    if (!facts.ok) return facts;
    const refusal = withdrawError(facts.enroll);
    if (refusal || !facts.linked) return refuse(refusal ?? NOT_LINKED);

    const { teamId, participantId } = entrantOf(
      facts.enroll.scoring,
      facts.linked,
    );
    const [removed] = await tx
      .delete(entrant)
      .where(
        and(
          eq(entrant.competitionId, competitionId),
          teamId
            ? eq(entrant.teamId, teamId)
            : eq(entrant.participantId, participantId!),
        ),
      )
      .returning({ seedPosition: entrant.seedPosition });
    if (removed) {
      // Two steps through negatives: `(competition_id, seed_position)` is
      // unique and checked row by row.
      await tx
        .update(entrant)
        .set({ seedPosition: sql`-${entrant.seedPosition}` })
        .where(
          and(
            eq(entrant.competitionId, competitionId),
            gt(entrant.seedPosition, removed.seedPosition),
          ),
        );
      await tx
        .update(entrant)
        .set({ seedPosition: sql`-${entrant.seedPosition} - 1` })
        .where(
          and(
            eq(entrant.competitionId, competitionId),
            lt(entrant.seedPosition, 0),
          ),
        );
    }
    return { ok: true };
  });
}

/**
 * A linked Participant joins a Squad the Host created in a Squads Bracket:
 * their own Team's, at most 16, one Squad per Competition (`squadError`,
 * as a Host's Squad save), under the Competition's row lock.
 */
export async function joinSquad(
  competitionId: string,
  squadId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedFacts(tx, competitionId, ctx, squadId);
    if (!facts.ok) return facts;
    const refusal = enrollError(facts.enroll);
    if (refusal || !facts.linked) return refuse(refusal ?? NOT_LINKED);
    const { participantId } = facts.linked;

    // The Squad's Participants and the joiner, as a Host's save checks
    // them; the joiner is locked `for share` so a Team change waits.
    const [joined] = await tx
      .select({ name: squad.name, teamId: squad.teamId })
      .from(squad)
      .where(eq(squad.id, squadId));
    const inSquad = await tx
      .select({
        id: participant.id,
        displayName: participant.displayName,
        teamId: participant.teamId,
      })
      .from(squadParticipant)
      .innerJoin(
        participant,
        eq(participant.id, squadParticipant.participantId),
      )
      .where(eq(squadParticipant.squadId, squadId));
    const [joiner] = await tx
      .select({
        id: participant.id,
        displayName: participant.displayName,
        teamId: participant.teamId,
      })
      .from(participant)
      .where(eq(participant.id, participantId))
      .for("share");
    const [labels] = await tx
      .select({ teamLabel: warWeek.teamLabel })
      .from(warWeek)
      .where(eq(warWeek.id, ctx.warWeekId));
    const squadRefusal = squadError({
      name: joined.name,
      teamId: joined.teamId,
      participants: [...inSquad, joiner],
      taken: {},
      teamLabel: labels?.teamLabel,
    });
    if (squadRefusal) return refuse(squadRefusal.error);

    await tx.insert(squadParticipant).values({ squadId, participantId });
    return { ok: true };
  });
}

/**
 * A linked Participant leaves their Squad before enrollment closes; the
 * last Participant in a Squad can't (the Host removes the Squad).
 */
export async function leaveSquad(
  competitionId: string,
  squadId: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const facts = await lockedFacts(tx, competitionId, ctx, squadId);
    if (!facts.ok) return facts;
    const refusal = withdrawError(facts.enroll);
    if (refusal || !facts.linked) return refuse(refusal ?? NOT_LINKED);

    await tx
      .delete(squadParticipant)
      .where(
        and(
          eq(squadParticipant.squadId, squadId),
          eq(squadParticipant.participantId, facts.linked.participantId),
        ),
      );
    return { ok: true };
  });
}
