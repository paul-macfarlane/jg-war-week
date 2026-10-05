import { and, eq, inArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  entrant,
  participant,
  squad,
  squadParticipant,
} from "@/db/schema";
import {
  type MatchReportFacet,
  matchReportState,
} from "@/lib/bracket/self-report";
import { loadBracket } from "@/queries/brackets";

export type MatchReportFacts = {
  /** What `can("bracket.match-report", …)` checks. */
  matchReport: MatchReportFacet;
  /** The Participant the email links to, or null; the same as the facet's. */
  linked: MatchReportFacet["linked"];
};

/**
 * The facts a self-report is checked against (ADR 0011): the Competition's
 * setting, the Match's state in its own Bracket and its Entrants, and the
 * Participant of the Competition's War Week whose email is `email`,
 * ignoring case (account linking; more than one match counts as none), with
 * their Team and their Squad in this Competition. Matches on the email
 * without ever selecting an email column back.
 */
export async function getMatchReportFacts(
  competitionId: string,
  matchId: string,
  email: string | null | undefined,
  dbOrTx: DBOrTx = db,
): Promise<MatchReportFacts> {
  const [found] = await dbOrTx
    .select({
      warWeekId: competition.warWeekId,
      selfReport: competition.selfReport,
      format: competition.format,
      bracketConfig: competition.bracketConfig,
    })
    .from(competition)
    .where(eq(competition.id, competitionId))
    .limit(1);
  if (!found) {
    return {
      matchReport: {
        selfReport: false,
        match: "missing",
        linked: null,
        entrants: [],
      },
      linked: null,
    };
  }

  const [bracket, linked] = await Promise.all([
    loadBracket(competitionId, dbOrTx, found),
    linkedParticipant(competitionId, found.warWeekId, email, dbOrTx),
  ]);
  const match = bracket.matches.find((h) => h.id === matchId);
  const entrantIds = match
    ? match.slots.flatMap((s) => (s.entrantId ? [s.entrantId] : []))
    : [];
  const entrants = entrantIds.length
    ? await dbOrTx
        .select({
          teamId: entrant.teamId,
          participantId: entrant.participantId,
          squadId: entrant.squadId,
        })
        .from(entrant)
        .where(
          and(
            eq(entrant.competitionId, competitionId),
            inArray(entrant.id, entrantIds),
          ),
        )
    : [];

  return {
    matchReport: {
      selfReport: found.selfReport,
      match: match ? matchReportState(bracket, match) : "missing",
      linked,
      entrants,
    },
    linked,
  };
}

async function linkedParticipant(
  competitionId: string,
  warWeekId: string,
  email: string | null | undefined,
  dbOrTx: DBOrTx,
): Promise<MatchReportFacet["linked"]> {
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
