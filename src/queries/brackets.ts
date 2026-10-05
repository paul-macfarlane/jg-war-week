import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  type WarWeek,
  bracketMatch,
  bracketMatchEntrant,
  competition,
  entrant,
  participant,
  squad,
  squadParticipant,
  team,
} from "@/db/schema";
import { DEFAULT_BRACKET_CONFIG, configOf } from "@/lib/bracket/config";
import { bracketWinner } from "@/lib/bracket/formats";
import type { Bracket, Entrant } from "@/lib/bracket/types";
import { isBracketFormat } from "@/lib/bracket/view";
import { isLoggedFormat } from "@/lib/enums";
import type { EntryPoints } from "@/lib/results-table";
import { isUuid } from "@/lib/uuid";
import { getCompetitionEntryPoints } from "@/queries/entry-points";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

/** An Entrant with what the Bracket view shows and closing needs. */
export type BracketEntrant = Entrant & {
  /** The Entrant row's own Team: null for a Participant or a Squad. */
  teamId: string | null;
  participantId: string | null;
  squadId: string | null;
  /** A Squad's Participants' display names, by name; [] otherwise. */
  participantNames: string[];
  /**
   * An individual Entrant's picture URL; null for initials and for Teams
   * and Squads.
   */
  image?: string | null;
  /**
   * The Team a Placement Points Entry goes to: the Team itself, or a
   * Squad's Team; null for a Participant.
   */
  pointsTeamId: string | null;
  /** The Team's color (a Participant's or Squad's Team), or null without one. */
  color: string | null;
  /**
   * A Participant or Squad Entrant's Team name, for `get_bracket`; null
   * without one.
   */
  teamName: string | null;
};

export type BracketCompetition = Pick<
  Competition,
  | "id"
  | "warWeekId"
  | "name"
  | "scoring"
  | "format"
  | "placementPoints"
  | "scoreDirection"
  | "scoreUnit"
  | "closedAt"
  | "selfReport"
  | "selfEnroll"
  | "entrantLimit"
>;

export type BracketView = {
  competition: BracketCompetition;
  /** By Seed Position. */
  entrants: BracketEntrant[];
  bracket: Bracket;
  /** The Winner's Entrant id, once the final is decided. */
  winner: string | null;
  closed: boolean;
  /**
   * A Closed (closed) Bracket's Points Entries, target and points: what
   * its podium shows. [] while it isn't Closed.
   */
  entryPoints: EntryPoints[];
};

const participantTeam = alias(team, "participant_team");
const squadTeam = alias(team, "squad_team");

/** Each Squad's Participants' display names, by name. */
async function squadParticipantNames(
  squadIds: string[],
  dbOrTx: DBOrTx,
): Promise<Map<string, string[]>> {
  const names = new Map<string, string[]>();
  if (squadIds.length === 0) return names;
  const rows = await withProfile(
    dbOrTx
      .select({
        squadId: squadParticipant.squadId,
        displayName: participantNameSql(),
      })
      .from(squadParticipant)
      .innerJoin(
        participant,
        eq(participant.id, squadParticipant.participantId),
      )
      .$dynamic(),
  )
    .where(inArray(squadParticipant.squadId, squadIds))
    .orderBy(asc(participantNameSql()));
  for (const row of rows) {
    names.set(row.squadId, [
      ...(names.get(row.squadId) ?? []),
      row.displayName,
    ]);
  }
  return names;
}

/**
 * A Competition's Entrants by Seed Position, labelled with the Team name,
 * the Participant's display name or the Squad's name.
 */
export async function getBracketEntrants(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<BracketEntrant[]> {
  if (!isUuid(competitionId)) return [];
  const rows = await withProfile(
    dbOrTx
      .select({
        id: entrant.id,
        seedPosition: entrant.seedPosition,
        teamId: entrant.teamId,
        participantId: entrant.participantId,
        squadId: entrant.squadId,
        teamName: team.name,
        teamColor: team.color,
        participantName: participantNameSql(),
        participantImage: participantImageSql(),
        participantTeamColor: participantTeam.color,
        participantTeamName: participantTeam.name,
        squadName: squad.name,
        squadTeamId: squad.teamId,
        squadTeamColor: squadTeam.color,
        squadTeamName: squadTeam.name,
      })
      .from(entrant)
      .leftJoin(team, eq(team.id, entrant.teamId))
      .leftJoin(participant, eq(participant.id, entrant.participantId))
      .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
      .leftJoin(squad, eq(squad.id, entrant.squadId))
      .leftJoin(squadTeam, eq(squadTeam.id, squad.teamId))
      .$dynamic(),
  )
    .where(eq(entrant.competitionId, competitionId))
    .orderBy(asc(entrant.seedPosition));
  const names = await squadParticipantNames(
    rows.flatMap((row) => (row.squadId ? [row.squadId] : [])),
    dbOrTx,
  );
  return rows.map((row) => ({
    id: row.id,
    seedPosition: row.seedPosition,
    label: row.teamName ?? row.participantName ?? row.squadName ?? "Unknown",
    teamId: row.teamId,
    participantId: row.participantId,
    squadId: row.squadId,
    participantNames: row.squadId ? (names.get(row.squadId) ?? []) : [],
    image: row.participantId ? row.participantImage : null,
    pointsTeamId: row.teamId ?? row.squadTeamId ?? null,
    color:
      row.teamColor ?? row.participantTeamColor ?? row.squadTeamColor ?? null,
    // A Team Entrant's own name, or a Participant or Squad Entrant's Team name.
    teamName:
      row.teamName ?? row.participantTeamName ?? row.squadTeamName ?? null,
  }));
}

/**
 * A Competition's Bracket from its Format, config and Match rows; no Matches
 * before Generate. Pass `known` when the Competition's `format` and
 * `bracketConfig` are already loaded, to skip reading them again.
 */
export async function loadBracket(
  competitionId: string,
  dbOrTx: DBOrTx = db,
  known?: Pick<Competition, "format" | "bracketConfig">,
): Promise<Bracket> {
  const found =
    known ??
    (
      await dbOrTx
        .select({
          format: competition.format,
          bracketConfig: competition.bracketConfig,
        })
        .from(competition)
        .where(eq(competition.id, competitionId))
        .limit(1)
    )[0];
  if (!found || !isBracketFormat(found.format)) {
    // A Placement, Head-to-head, Best score or Participation Competition (or a missing one) has no Bracket and
    // so no Matches: the config returned here is arbitrary, since nothing
    // reads its rules for an empty Bracket, and getBracket shows no
    // Winner for a points Competition.
    return { config: DEFAULT_BRACKET_CONFIG, matches: [] };
  }
  const brackets = await loadBrackets(
    [{ id: competitionId, bracketConfig: found.bracketConfig }],
    dbOrTx,
  );
  return brackets.get(competitionId)!;
}

/**
 * Several Bracket Competitions' Brackets in two queries (their Matches, then
 * every Match's slots), by Competition id; a Bracket with no Matches before
 * Generate. Pass only Competitions of the Bracket Format.
 */
export async function loadBrackets(
  competitions: Pick<Competition, "id" | "bracketConfig">[],
  dbOrTx: DBOrTx = db,
): Promise<Map<string, Bracket>> {
  const brackets = new Map<string, Bracket>(
    competitions.map((c) => [c.id, { config: configOf(c), matches: [] }]),
  );
  if (competitions.length === 0) return brackets;
  // An explicit list: the reporter columns (an email among them) are never
  // read into a Bracket, which feeds pages and MCP.
  const matches = await dbOrTx
    .select({
      id: bracketMatch.id,
      competitionId: bracketMatch.competitionId,
      round: bracketMatch.round,
      position: bracketMatch.position,
      status: bracketMatch.status,
      slotCount: bracketMatch.slotCount,
      advanceCount: bracketMatch.advanceCount,
      winnerToMatchId: bracketMatch.winnerToMatchId,
      winnerToSlot: bracketMatch.winnerToSlot,
      loserToMatchId: bracketMatch.loserToMatchId,
      loserToSlot: bracketMatch.loserToSlot,
      thirdPlace: bracketMatch.thirdPlace,
      recordedAt: bracketMatch.recordedAt,
    })
    .from(bracketMatch)
    .where(
      inArray(
        bracketMatch.competitionId,
        competitions.map((c) => c.id),
      ),
    )
    .orderBy(asc(bracketMatch.round), asc(bracketMatch.position));
  const slots = matches.length
    ? await dbOrTx
        .select()
        .from(bracketMatchEntrant)
        .where(
          inArray(
            bracketMatchEntrant.matchId,
            matches.map((h) => h.id),
          ),
        )
    : [];
  const slotOf = new Map(slots.map((s) => [`${s.matchId}:${s.slot}`, s]));
  for (const row of matches) {
    brackets.get(row.competitionId)?.matches.push({
      id: row.id,
      round: row.round,
      position: row.position,
      status: row.status,
      advanceCount: row.advanceCount,
      winnerTo:
        row.winnerToMatchId !== null && row.winnerToSlot !== null
          ? { matchId: row.winnerToMatchId, slot: row.winnerToSlot }
          : null,
      loserTo:
        row.loserToMatchId !== null && row.loserToSlot !== null
          ? { matchId: row.loserToMatchId, slot: row.loserToSlot }
          : null,
      thirdPlace: row.thirdPlace,
      recordedAt: row.recordedAt,
      slots: Array.from({ length: row.slotCount }, (_, slot) => {
        const found = slotOf.get(`${row.id}:${slot}`);
        return {
          entrantId: found?.entrantId ?? null,
          place: found?.place ?? null,
          // The engine reads a Score as text; the column is numeric.
          score: found?.score == null ? null : String(found.score),
        };
      }),
    });
  }
  return brackets;
}

/**
 * A Competition's Bracket for display: its Entrants with labels and colors,
 * its Matches, the Winner, whether it's closed and, once it is, its
 * Points Entries. Undefined when there's no such Competition, or it's run as Head-to-head or Best score (a Head-to-head or Best score Competition is never
 * a Bracket). A points Competition returns an empty Bracket.
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
      bracketConfig: competition.bracketConfig,
      placementPoints: competition.placementPoints,
      scoreDirection: competition.scoreDirection,
      scoreUnit: competition.scoreUnit,
      closedAt: competition.closedAt,
      selfReport: competition.selfReport,
      selfEnroll: competition.selfEnroll,
      entrantLimit: competition.entrantLimit,
    })
    .from(competition)
    .where(eq(competition.id, competitionId))
    .limit(1);
  if (
    !found ||
    isLoggedFormat(found.format) ||
    found.format === "participation" ||
    // R23: a League is never a Bracket; S2 adds its own view
    // (`src/queries/league.ts`).
    found.format === "league"
  ) {
    return undefined;
  }
  // The config reaches the view through the Bracket, not the Competition.
  const { bracketConfig, ...shown } = found;
  const [entrants, bracket, entryPoints] = await Promise.all([
    getBracketEntrants(competitionId, dbOrTx),
    loadBracket(competitionId, dbOrTx, { format: found.format, bracketConfig }),
    found.closedAt === null
      ? Promise.resolve([])
      : getCompetitionEntryPoints(competitionId, dbOrTx),
  ]);
  return {
    competition: shown,
    entrants,
    bracket,
    // A points Competition has no Bracket, so no Winner.
    winner: isBracketFormat(found.format) ? bracketWinner(bracket) : null,
    closed: found.closedAt !== null,
    entryPoints,
  };
}

export type BracketCompetitionLink = Pick<
  Competition,
  "id" | "name" | "format" | "closedAt"
>;

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

/** A Squad of a Competition, with its Team and Participants by name. */
export type SquadRow = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  participants: { id: string; displayName: string }[];
};

/** A Competition's Squads by name, each with its Participants by name. */
export async function getSquads(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<SquadRow[]> {
  const squads = await dbOrTx
    .select({
      id: squad.id,
      name: squad.name,
      teamId: squad.teamId,
      teamName: team.name,
      teamColor: team.color,
    })
    .from(squad)
    .innerJoin(team, eq(team.id, squad.teamId))
    .where(eq(squad.competitionId, competitionId))
    .orderBy(asc(squad.name));
  if (squads.length === 0) return [];
  const rows = await withProfile(
    dbOrTx
      .select({
        squadId: squadParticipant.squadId,
        id: participant.id,
        displayName: participantNameSql(),
      })
      .from(squadParticipant)
      .innerJoin(
        participant,
        eq(participant.id, squadParticipant.participantId),
      )
      .$dynamic(),
  )
    .where(
      inArray(
        squadParticipant.squadId,
        squads.map((s) => s.id),
      ),
    )
    .orderBy(asc(participantNameSql()));
  return squads.map((s) => ({
    ...s,
    participants: rows
      .filter((row) => row.squadId === s.id)
      .map(({ id, displayName }) => ({ id, displayName })),
  }));
}

/**
 * Each Participant's Squad in a Competition (a Participant is in at most
 * one), so the Bracket view can find Your Squad's Entrant.
 */
export async function getParticipantSquadIds(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<Record<string, string>> {
  const rows = await dbOrTx
    .select({
      participantId: squadParticipant.participantId,
      squadId: squadParticipant.squadId,
    })
    .from(squadParticipant)
    .innerJoin(squad, eq(squad.id, squadParticipant.squadId))
    .where(eq(squad.competitionId, competitionId));
  return Object.fromEntries(
    rows.map((row) => [row.participantId, row.squadId]),
  );
}

/** What the results screen says when a reporter's Participant is gone. */
export const UNKNOWN_REPORTER = "a Participant";

/**
 * Who self-reported each Match's current result, by Match id: the reporter's
 * Participant name, or "a Participant" once that row is deleted. Never the
 * email, which stays on the Match for audit only.
 */
export async function getMatchReporters(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<Record<string, string>> {
  const rows = await withProfile(
    dbOrTx
      .select({ matchId: bracketMatch.id, name: participantNameSql() })
      .from(bracketMatch)
      .leftJoin(
        participant,
        eq(participant.id, bracketMatch.reportedByParticipantId),
      )
      .$dynamic(),
  ).where(
    and(
      eq(bracketMatch.competitionId, competitionId),
      isNotNull(bracketMatch.reportedByEmail),
    ),
  );
  return Object.fromEntries(
    rows.map((row) => [row.matchId, row.name ?? UNKNOWN_REPORTER]),
  );
}
