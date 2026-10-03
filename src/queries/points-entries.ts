import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DBOrTx, db } from "@/db";
import { WarWeek, competition, participant, team } from "@/db/schema";
import { participantNameSql, withProfile } from "@/queries/profile-join";

export type PointsEntryFormCompetition = {
  id: string;
  name: string;
  scoring: "team" | "individual";
  placementPoints: number[] | null;
};

export type PointsEntryFormTarget = {
  id: string;
  name: string;
  /** A Participant's Team name; null for Teams and unassigned Participants. */
  team: string | null;
};

/** A Participant as the forms offer one, with their Team's id (or null). */
export type PointsEntryFormParticipant = PointsEntryFormTarget & {
  teamId: string | null;
};

export type PointsEntryFormOptions = {
  competitions: PointsEntryFormCompetition[];
  teams: PointsEntryFormTarget[];
  participants: PointsEntryFormParticipant[];
};

const participantTeam = alias(team, "participant_team");

/**
 * Every Competition, Team and Participant of the War Week, each by name, for
 * the pickers on the Competition pages.
 */
export async function getPointsEntryFormOptions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<PointsEntryFormOptions> {
  const [competitions, teams, participants] = await Promise.all([
    dbOrTx
      .select({
        id: competition.id,
        name: competition.name,
        scoring: competition.scoring,
        placementPoints: competition.placementPoints,
      })
      .from(competition)
      .where(eq(competition.warWeekId, warWeek.id))
      .orderBy(asc(competition.name)),
    dbOrTx
      .select({ id: team.id, name: team.name })
      .from(team)
      .where(eq(team.warWeekId, warWeek.id))
      .orderBy(asc(team.name)),
    withProfile(
      dbOrTx
        .select({
          id: participant.id,
          name: participantNameSql(),
          team: participantTeam.name,
          teamId: participant.teamId,
        })
        .from(participant)
        .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
        .$dynamic(),
    )
      .where(eq(participant.warWeekId, warWeek.id))
      .orderBy(asc(participantNameSql())),
  ]);

  return {
    competitions,
    teams: teams.map((t) => ({ ...t, team: null })),
    participants,
  };
}
