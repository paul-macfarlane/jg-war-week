import { and, asc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  type WarWeek,
  competition,
  entrant,
  heat,
  heatEntrant,
  participant,
  team,
} from "@/db/schema";
import { champion } from "@/lib/bracket/engine";
import type { Bracket, Entrant, Heat } from "@/lib/bracket/types";
import { isUuid } from "@/lib/uuid";

/** An Entrant with what the Bracket view shows and finalizing needs. */
export type BracketEntrant = Entrant & {
  teamId: string | null;
  participantId: string | null;
  /** The Team's color (a Participant's Team), or null without one. */
  color: string | null;
};

export type BracketCompetition = Pick<
  Competition,
  | "id"
  | "warWeekId"
  | "name"
  | "scoring"
  | "format"
  | "bracketPoints"
  | "placementPoints"
  | "finalizedAt"
>;

export type BracketView = {
  competition: BracketCompetition;
  /** By Seed Position. */
  entrants: BracketEntrant[];
  bracket: Bracket;
  /** The champion's Entrant id, once the final is decided. */
  champion: string | null;
  finalized: boolean;
};

const participantTeam = alias(team, "participant_team");

/**
 * A Competition's Entrants by Seed Position, labelled with the Team name or
 * the Participant's display name.
 */
export async function getBracketEntrants(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<BracketEntrant[]> {
  const rows = await dbOrTx
    .select({
      id: entrant.id,
      seedPosition: entrant.seedPosition,
      teamId: entrant.teamId,
      participantId: entrant.participantId,
      teamName: team.name,
      teamColor: team.color,
      participantName: participant.displayName,
      participantTeamColor: participantTeam.color,
    })
    .from(entrant)
    .leftJoin(team, eq(team.id, entrant.teamId))
    .leftJoin(participant, eq(participant.id, entrant.participantId))
    .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
    .where(eq(entrant.competitionId, competitionId))
    .orderBy(asc(entrant.seedPosition));
  return rows.map((row) => ({
    id: row.id,
    seedPosition: row.seedPosition,
    label: row.teamName ?? row.participantName ?? "Unknown",
    teamId: row.teamId,
    participantId: row.participantId,
    color: row.teamColor ?? row.participantTeamColor ?? null,
  }));
}

/** A Competition's Bracket from its Heat rows; no Heats before Generate. */
export async function loadBracket(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<Bracket> {
  const heats = await dbOrTx
    .select()
    .from(heat)
    .where(eq(heat.competitionId, competitionId))
    .orderBy(asc(heat.round), asc(heat.position));
  const slots = heats.length
    ? await dbOrTx
        .select()
        .from(heatEntrant)
        .where(
          inArray(
            heatEntrant.heatId,
            heats.map((h) => h.id),
          ),
        )
    : [];
  return {
    heats: heats.map((row): Heat => ({
      id: row.id,
      round: row.round,
      position: row.position,
      status: row.status,
      winnerTo:
        row.winnerToHeatId !== null && row.winnerToSlot !== null
          ? { heatId: row.winnerToHeatId, slot: row.winnerToSlot }
          : null,
      slots: [0, 1].map((slot) => {
        const found = slots.find((s) => s.heatId === row.id && s.slot === slot);
        return {
          entrantId: found?.entrantId ?? null,
          place: found?.place ?? null,
          score: found?.score ?? null,
          forfeited: found?.forfeited ?? false,
        };
      }),
    })),
  };
}

/**
 * A Competition's Bracket for display: its Entrants with labels and colors,
 * its Heats, the champion and whether it's finalized. Undefined when there's
 * no such Competition.
 */
export async function getBracket(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<BracketView | undefined> {
  if (!isUuid(competitionId)) return undefined;
  const [found] = await dbOrTx
    .select({
      id: competition.id,
      warWeekId: competition.warWeekId,
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
      bracketPoints: competition.bracketPoints,
      placementPoints: competition.placementPoints,
      finalizedAt: competition.finalizedAt,
    })
    .from(competition)
    .where(eq(competition.id, competitionId))
    .limit(1);
  if (!found) return undefined;
  const [entrants, bracket] = await Promise.all([
    getBracketEntrants(competitionId, dbOrTx),
    loadBracket(competitionId, dbOrTx),
  ]);
  return {
    competition: found,
    entrants,
    bracket,
    champion: champion(bracket),
    finalized: found.finalizedAt !== null,
  };
}

export type BracketCompetitionLink = Pick<
  Competition,
  "id" | "name" | "format" | "finalizedAt"
>;

/** A War Week's Competitions run as a Bracket, by name. */
export async function getBracketCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<BracketCompetitionLink[]> {
  return dbOrTx
    .select({
      id: competition.id,
      name: competition.name,
      format: competition.format,
      finalizedAt: competition.finalizedAt,
    })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        ne(competition.format, "points"),
      ),
    )
    .orderBy(asc(competition.name));
}

/**
 * Each Participant's Team id in a War Week, so the Bracket view can find
 * Your Team's Entrant in a team Competition.
 */
export async function getParticipantTeamIds(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<Record<string, string>> {
  const rows = await dbOrTx
    .select({ id: participant.id, teamId: participant.teamId })
    .from(participant)
    .where(
      and(eq(participant.warWeekId, warWeek.id), isNotNull(participant.teamId)),
    );
  return Object.fromEntries(rows.map((row) => [row.id, row.teamId!]));
}
