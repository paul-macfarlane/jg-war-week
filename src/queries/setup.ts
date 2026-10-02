import { and, asc, count, eq, isNotNull } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  type Participant,
  type Team,
  type WarWeek,
  award,
  awardParticipant,
  competition,
  day,
  entrant,
  participant,
  pointsEntry,
  profile,
  scheduleItem,
  squad,
  squadParticipant,
  team,
} from "@/db/schema";
import { profileOn } from "@/queries/profile-join";

/** A Day as the setup page lists it. */
export type SetupDay = {
  id: string;
  date: string;
  dayTheme: string;
  scheduleItemCount: number;
};

/** A War Week's Days in date order, each with its Schedule Item count. */
export async function getSetupDays(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<SetupDay[]> {
  return dbOrTx
    .select({
      id: day.id,
      date: day.date,
      dayTheme: day.dayTheme,
      scheduleItemCount: count(scheduleItem.id),
    })
    .from(day)
    .leftJoin(scheduleItem, eq(scheduleItem.dayId, day.id))
    .where(eq(day.warWeekId, warWeek.id))
    .groupBy(day.id)
    .orderBy(asc(day.date));
}

/** A Team as the setup page lists it, with what would block deleting it. */
export type SetupTeam = Pick<Team, "id" | "name" | "color" | "logoUrl"> & {
  participantCount: number;
  pointsEntryCount: number;
  awardCount: number;
  entrantCount: number;
  squadCount: number;
};

/** A War Week's Teams by name. */
export async function getSetupTeams(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<SetupTeam[]> {
  return dbOrTx
    .select({
      id: team.id,
      name: team.name,
      color: team.color,
      logoUrl: team.logoUrl,
      participantCount: dbOrTx.$count(
        participant,
        eq(participant.teamId, team.id),
      ),
      pointsEntryCount: dbOrTx.$count(
        pointsEntry,
        eq(pointsEntry.teamId, team.id),
      ),
      awardCount: dbOrTx.$count(award, eq(award.teamId, team.id)),
      entrantCount: dbOrTx.$count(entrant, eq(entrant.teamId, team.id)),
      squadCount: dbOrTx.$count(squad, eq(squad.teamId, team.id)),
    })
    .from(team)
    .where(eq(team.warWeekId, warWeek.id))
    .orderBy(asc(team.name));
}

/** A Participant as the roster table lists it. */
export type SetupParticipant = Pick<
  Participant,
  "id" | "displayName" | "companyTag" | "email" | "teamId" | "isLeader"
> & {
  /**
   * The Profile name the person set for their linked account, or null. The
   * roster form shows it read-only; `displayName` stays the typed fallback.
   */
  profileName: string | null;
  pointsEntryCount: number;
  awardCount: number;
  entrantCount: number;
  squadCount: number;
};

/** A War Week's Participants by display name. */
export async function getSetupParticipants(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<SetupParticipant[]> {
  return dbOrTx
    .select({
      id: participant.id,
      displayName: participant.displayName,
      profileName: profile.name,
      companyTag: participant.companyTag,
      email: participant.email,
      teamId: participant.teamId,
      isLeader: participant.isLeader,
      pointsEntryCount: dbOrTx.$count(
        pointsEntry,
        eq(pointsEntry.participantId, participant.id),
      ),
      awardCount: dbOrTx.$count(
        awardParticipant,
        eq(awardParticipant.participantId, participant.id),
      ),
      entrantCount: dbOrTx.$count(
        entrant,
        eq(entrant.participantId, participant.id),
      ),
      squadCount: dbOrTx.$count(
        squadParticipant,
        eq(squadParticipant.participantId, participant.id),
      ),
    })
    .from(participant)
    .leftJoin(profile, profileOn())
    .where(eq(participant.warWeekId, warWeek.id))
    .orderBy(asc(participant.displayName));
}

/** A Competition as the setup page lists it. */
export type SetupCompetition = Pick<
  Competition,
  | "id"
  | "name"
  | "description"
  | "scoring"
  | "maxPoints"
  | "placementPoints"
  | "countsTowardTeam"
  | "competitionGroup"
  | "format"
> & { pointsEntryCount: number; scheduleItemCount: number };

/** A War Week's Competitions by name. */
export async function getSetupCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<SetupCompetition[]> {
  return dbOrTx
    .select({
      id: competition.id,
      name: competition.name,
      description: competition.description,
      scoring: competition.scoring,
      maxPoints: competition.maxPoints,
      placementPoints: competition.placementPoints,
      countsTowardTeam: competition.countsTowardTeam,
      competitionGroup: competition.competitionGroup,
      format: competition.format,
      pointsEntryCount: dbOrTx.$count(
        pointsEntry,
        eq(pointsEntry.competitionId, competition.id),
      ),
      scheduleItemCount: dbOrTx.$count(
        scheduleItem,
        eq(scheduleItem.competitionId, competition.id),
      ),
    })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id))
    .orderBy(asc(competition.name));
}

/** Competition Groups already used in a War Week, sorted, for suggestions. */
export async function getCompetitionGroupSuggestions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<string[]> {
  const rows = await dbOrTx
    .selectDistinct({ group: competition.competitionGroup })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        isNotNull(competition.competitionGroup),
      ),
    )
    .orderBy(asc(competition.competitionGroup));
  return rows.flatMap((row) => (row.group ? [row.group] : []));
}

/** Company Tags used in any War Week, sorted by name, for suggestions. */
export async function getCompanyTagSuggestions(
  dbOrTx: DBOrTx = db,
): Promise<string[]> {
  const rows = await dbOrTx
    .selectDistinct({ tag: participant.companyTag })
    .from(participant)
    .where(isNotNull(participant.companyTag))
    .orderBy(asc(participant.companyTag));
  return rows.flatMap((row) => (row.tag ? [row.tag] : []));
}
