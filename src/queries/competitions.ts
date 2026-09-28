import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  WarWeek,
  competition,
  participant,
  pointsEntry,
  team,
} from "@/db/schema";
import {
  type CompetitionLedger,
  type CompetitionListItem,
  buildCompetitionLedger,
  groupCompetitions,
} from "@/lib/competitions";
import { isUuid } from "@/lib/uuid";

const competitionColumns = {
  id: competition.id,
  name: competition.name,
  description: competition.description,
  maxPoints: competition.maxPoints,
  scoring: competition.scoring,
  countsTowardTeam: competition.countsTowardTeam,
  competitionGroup: competition.competitionGroup,
} satisfies Record<keyof CompetitionListItem, unknown>;

/**
 * Finds a War Week's Competition by name for `get_bracket`: an exact name
 * wins; else a case-insensitive (trimmed) name when exactly one Competition
 * has it; else `undefined` (names are unique per War Week only
 * case-sensitively).
 */
export async function getCompetitionByName(
  warWeek: Pick<WarWeek, "id">,
  name: string,
  dbOrTx: DBOrTx = db,
): Promise<Pick<Competition, "id"> | undefined> {
  const rows = await dbOrTx
    .select({ id: competition.id, name: competition.name })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id));
  const exact = rows.find((row) => row.name === name);
  if (exact) return exact;
  const target = name.trim().toLowerCase();
  const sameName = rows.filter(
    (row) => row.name.trim().toLowerCase() === target,
  );
  return sameName.length === 1 ? sameName[0] : undefined;
}

/** Loads a War Week's Competitions, grouped by `groupCompetitions`. */
export async function getCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
) {
  const rows = await dbOrTx
    .select(competitionColumns)
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id));
  return groupCompetitions(rows);
}

const participantTeam = alias(team, "participant_team");

/** A left-joined Team's columns, or null when the join found no Team. */
function toLedgerTeam(name: string | null, color: string | null) {
  return name !== null && color !== null ? { name, color } : null;
}

/**
 * Loads one Competition of a War Week and its ledger. Returns `undefined`
 * when `id` is not a Competition of this War Week.
 */
export async function getCompetitionWithLedger(
  warWeek: Pick<WarWeek, "id">,
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<
  { competition: CompetitionListItem; ledger: CompetitionLedger } | undefined
> {
  if (!isUuid(id)) return undefined;

  const [found] = await dbOrTx
    .select(competitionColumns)
    .from(competition)
    .where(and(eq(competition.id, id), eq(competition.warWeekId, warWeek.id)))
    .limit(1);
  if (!found) return undefined;

  const rows = await dbOrTx
    .select({
      id: pointsEntry.id,
      points: pointsEntry.points,
      note: pointsEntry.note,
      enteredAt: pointsEntry.enteredAt,
      teamName: team.name,
      teamColor: team.color,
      participantName: participant.displayName,
      participantTeamName: participantTeam.name,
      participantTeamColor: participantTeam.color,
    })
    .from(pointsEntry)
    .leftJoin(team, eq(team.id, pointsEntry.teamId))
    .leftJoin(participant, eq(participant.id, pointsEntry.participantId))
    .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
    .where(eq(pointsEntry.competitionId, found.id));

  return {
    competition: found,
    ledger: buildCompetitionLedger({
      rows: rows.map((row) => ({
        id: row.id,
        points: row.points,
        note: row.note,
        enteredAt: row.enteredAt,
        team: toLedgerTeam(row.teamName, row.teamColor),
        participant:
          row.participantName !== null
            ? {
                displayName: row.participantName,
                team: toLedgerTeam(
                  row.participantTeamName,
                  row.participantTeamColor,
                ),
              }
            : null,
      })),
    }),
  };
}
