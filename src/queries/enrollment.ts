import { and, count, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  entrant,
  game,
  heat,
  participant,
  squad,
  squadParticipant,
} from "@/db/schema";
import { gamesConfigOf } from "@/lib/games/config";
import {
  type EnrollFacet,
  enrollmentUnavailable,
} from "@/lib/games/enroll-rule";
import { isUuid } from "@/lib/uuid";

export type EnrollFacts = {
  /** What `can("competition.enroll" | "competition.withdraw", …)` checks. */
  enroll: EnrollFacet;
  /** The Participant the email links to, or null; the same as the facet's. */
  linked: EnrollFacet["linked"];
};

/** A facet that refuses: the switch reads as off. */
function refusingFacet(): EnrollFacet {
  return {
    selfEnroll: false,
    closed: false,
    built: false,
    hasGames: false,
    entrantLimit: null,
    entrantCount: 0,
    enrollClosesAt: null,
    now: new Date(),
    scoring: "individual",
    linked: null,
    entrants: [],
    hasSquads: false,
    squad: null,
  };
}

/**
 * The facts self-enrollment is checked against (ADR 0006): the
 * Competition's switch and close conditions (Bracket built, Entrant limit,
 * close time, finalized, first Game), its Entrants and Squads, the Squad
 * being joined or left (only a Squad of this Competition), and the
 * Participant of the Competition's War Week whose email is `email`,
 * ignoring case (account linking; more than one match counts as none), with
 * their Team and their Squad in this Competition. Matches on the email
 * without ever selecting an email column back. A missing Competition gives
 * a facet that refuses.
 */
export async function getEnrollFacts(
  competitionId: string,
  email: string | null | undefined,
  { squadId }: { squadId?: string | null } = {},
  dbOrTx: DBOrTx = db,
): Promise<EnrollFacts> {
  const [found] = isUuid(competitionId)
    ? await dbOrTx
        .select({
          warWeekId: competition.warWeekId,
          scoring: competition.scoring,
          format: competition.format,
          finalizedAt: competition.finalizedAt,
          gameType: competition.gameType,
          gameConfig: competition.gameConfig,
          entrantsOpen: competition.entrantsOpen,
          selfEnroll: competition.selfEnroll,
          entrantLimit: competition.entrantLimit,
          enrollClosesAt: competition.enrollClosesAt,
        })
        .from(competition)
        .where(eq(competition.id, competitionId))
        .limit(1)
    : [];
  if (!found) return { enroll: refusingFacet(), linked: null };

  const [linked, entrants, heats, games, squads, posted] = await Promise.all([
    linkedParticipant(competitionId, found.warWeekId, email, dbOrTx),
    dbOrTx
      .select({
        teamId: entrant.teamId,
        participantId: entrant.participantId,
      })
      .from(entrant)
      .where(eq(entrant.competitionId, competitionId)),
    dbOrTx.$count(heat, eq(heat.competitionId, competitionId)),
    dbOrTx.$count(game, eq(game.competitionId, competitionId)),
    dbOrTx.$count(squad, eq(squad.competitionId, competitionId)),
    squadId === undefined || squadId === null
      ? Promise.resolve(null)
      : postedSquad(competitionId, squadId, dbOrTx),
  ]);

  const enroll: EnrollFacet = {
    // The switch reads as off where enrollment isn't offered (R3 decision 12).
    selfEnroll:
      found.selfEnroll &&
      enrollmentUnavailable({
        format: found.format,
        entrantsOpen: found.entrantsOpen,
        gameType: found.gameType,
        gameConfig: found.gameType
          ? gamesConfigOf({
              gameType: found.gameType,
              gameConfig: found.gameConfig,
            })
          : null,
      }) === null,
    closed: found.finalizedAt !== null,
    built: heats > 0,
    hasGames: games > 0,
    entrantLimit: found.entrantLimit,
    entrantCount: entrants.length,
    enrollClosesAt: found.enrollClosesAt,
    now: new Date(),
    scoring: found.scoring,
    linked,
    entrants,
    hasSquads: squads > 0,
    squad: posted,
  };
  return { enroll, linked };
}

/** The Squad of this Competition with that id, or "missing". */
async function postedSquad(
  competitionId: string,
  squadId: string,
  dbOrTx: DBOrTx,
): Promise<EnrollFacet["squad"]> {
  if (!isUuid(squadId)) return "missing";
  const [row] = await dbOrTx
    .select({
      id: squad.id,
      teamId: squad.teamId,
      participantCount: count(squadParticipant.participantId),
    })
    .from(squad)
    .leftJoin(squadParticipant, eq(squadParticipant.squadId, squad.id))
    .where(and(eq(squad.id, squadId), eq(squad.competitionId, competitionId)))
    .groupBy(squad.id, squad.teamId);
  return row ?? "missing";
}

async function linkedParticipant(
  competitionId: string,
  warWeekId: string,
  email: string | null | undefined,
  dbOrTx: DBOrTx,
): Promise<EnrollFacet["linked"]> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const rows = await dbOrTx
    .select({ participantId: participant.id, teamId: participant.teamId })
    .from(participant)
    .where(
      and(
        eq(participant.warWeekId, warWeekId),
        eq(sql`lower(${participant.email})`, normalized),
      ),
    )
    .limit(2);
  // Raw-SQL rows skip the write-time lowercasing: two matches link no one.
  if (rows.length !== 1) return null;
  const [{ participantId, teamId }] = rows;
  const [inSquad] = await dbOrTx
    .select({ squadId: squadParticipant.squadId })
    .from(squadParticipant)
    .innerJoin(squad, eq(squad.id, squadParticipant.squadId))
    .where(
      and(
        eq(squad.competitionId, competitionId),
        eq(squadParticipant.participantId, participantId),
      ),
    )
    .limit(1);
  return { participantId, teamId, squadId: inSquad?.squadId ?? null };
}
