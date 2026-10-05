import { and, asc, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  type WarWeek,
  competition,
  participant,
  participation,
  team,
  warWeek,
} from "@/db/schema";
import type { CheckInFacet } from "@/lib/participation/check-in-rule";
import { type TeamHeadcount, teamHeadcounts } from "@/lib/participation/score";
import type { EntryPoints } from "@/lib/results-table";
import { isUuid } from "@/lib/uuid";
import type { BracketCompetitionLink } from "@/queries/brackets";
import { getCompetitionEntryPoints } from "@/queries/entry-points";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

/** The columns a `participation` Competition's pages and Close read. */
export type ParticipationCompetition = Pick<
  Competition,
  | "id"
  | "warWeekId"
  | "name"
  | "scoring"
  | "placementPoints"
  | "participationPoints"
  | "selfCheckIn"
> & { closed: boolean };

/** Someone who took part, by name: never an email or who marked them. */
export type TookPartRow = {
  participantId: string;
  name: string;
  image: string | null;
  teamId: string | null;
  team: string | null;
  teamColor: string | null;
  /** True when they checked themselves in; false when the Host marked them. */
  checkedIn: boolean;
};

/** A Team's headcount and place among those who took part. */
export type TeamCountRow = TeamHeadcount & { name: string; color: string };

export type ParticipationView = {
  competition: ParticipationCompetition;
  /** By name. */
  tookPart: TookPartRow[];
  /** Team scoring only (empty otherwise): most first, ties sharing a place. */
  teamCounts: TeamCountRow[];
  /** Once Closed, its generated Points Entries; else empty. */
  entryPoints: EntryPoints[];
};

/**
 * A `participation` Competition with who took part (Profile names, ADR
 * 0007) and, in team scoring, each Team's headcount at their current Team.
 * Undefined for a malformed or unknown id or another Format.
 */
export async function getParticipationView(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<ParticipationView | undefined> {
  if (!isUuid(competitionId)) return undefined;
  const [found] = await dbOrTx
    .select({
      id: competition.id,
      warWeekId: competition.warWeekId,
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
      placementPoints: competition.placementPoints,
      participationPoints: competition.participationPoints,
      selfCheckIn: competition.selfCheckIn,
      closedAt: competition.closedAt,
    })
    .from(competition)
    .where(eq(competition.id, competitionId))
    .limit(1);
  if (!found || found.format !== "participation") return undefined;

  const rows = await withProfile(
    dbOrTx
      .select({
        participantId: participation.participantId,
        name: participantNameSql(),
        image: participantImageSql(),
        teamId: participant.teamId,
        team: team.name,
        teamColor: team.color,
        checkedIn: participation.checkedIn,
      })
      .from(participation)
      .innerJoin(participant, eq(participant.id, participation.participantId))
      .leftJoin(team, eq(team.id, participant.teamId))
      .$dynamic(),
  )
    .where(eq(participation.competitionId, competitionId))
    .orderBy(asc(participantNameSql()), asc(participation.participantId));

  const teams = new Map(
    rows.flatMap((r) =>
      r.teamId ? [[r.teamId, { name: r.team!, color: r.teamColor! }]] : [],
    ),
  );
  return {
    competition: {
      id: found.id,
      warWeekId: found.warWeekId,
      name: found.name,
      scoring: found.scoring,
      placementPoints: found.placementPoints,
      participationPoints: found.participationPoints,
      selfCheckIn: found.selfCheckIn,
      closed: found.closedAt !== null,
    },
    tookPart: rows,
    teamCounts:
      found.scoring === "team"
        ? teamHeadcounts(rows).map((h) => ({ ...h, ...teams.get(h.teamId)! }))
        : [],
    entryPoints:
      found.closedAt !== null
        ? await getCompetitionEntryPoints(found.id, dbOrTx)
        : [],
  };
}

export type CheckInFacts = {
  /** What `can("participation.check-in" | "participation.check-out", …)` checks. */
  checkIn: CheckInFacet;
  /** The Participant the email links to, or null; the same as the facet's. */
  linked: CheckInFacet["linked"];
};

/** A facet that refuses: not a `participation` Competition. */
function refusingFacet(): CheckInFacet {
  return {
    isParticipation: false,
    closed: false,
    selfCheckIn: false,
    scoring: "individual",
    teamLabel: "Team",
    linked: null,
    mark: null,
  };
}

/**
 * The facts Check in is checked against (ADR 0009): the Competition's
 * Format, close and switch, the War Week's Team Label, and the
 * Participant of the Competition's War Week whose email is `email`,
 * ignoring case (account linking; more than one match counts as none),
 * with their Team and their took-part row. Matches on the email without
 * ever selecting an email column back. A missing Competition gives a
 * facet that refuses.
 */
export async function getCheckInFacts(
  competitionId: string,
  email: string | null | undefined,
  dbOrTx: DBOrTx = db,
): Promise<CheckInFacts> {
  const [found] = isUuid(competitionId)
    ? await dbOrTx
        .select({
          warWeekId: competition.warWeekId,
          format: competition.format,
          scoring: competition.scoring,
          closedAt: competition.closedAt,
          selfCheckIn: competition.selfCheckIn,
          teamLabel: warWeek.teamLabel,
        })
        .from(competition)
        .innerJoin(warWeek, eq(warWeek.id, competition.warWeekId))
        .where(eq(competition.id, competitionId))
        .limit(1)
    : [];
  if (!found) return { checkIn: refusingFacet(), linked: null };

  const linked = await linkedIn(found.warWeekId, email, dbOrTx);
  const [mark] = linked
    ? await dbOrTx
        .select({ checkedIn: participation.checkedIn })
        .from(participation)
        .where(
          and(
            eq(participation.competitionId, competitionId),
            eq(participation.participantId, linked.participantId),
          ),
        )
        .limit(1)
    : [];
  const checkIn: CheckInFacet = {
    isParticipation: found.format === "participation",
    closed: found.closedAt !== null,
    selfCheckIn: found.selfCheckIn,
    scoring: found.scoring,
    teamLabel: found.teamLabel,
    linked,
    mark: mark ?? null,
  };
  return { checkIn, linked };
}

async function linkedIn(
  warWeekId: string,
  email: string | null | undefined,
  dbOrTx: DBOrTx,
): Promise<CheckInFacet["linked"]> {
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
  return rows.length === 1 ? rows[0] : null;
}

/** A War Week's `participation` Competitions, by name. */
export async function getParticipationCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<BracketCompetitionLink[]> {
  return dbOrTx
    .select({
      id: competition.id,
      name: competition.name,
      format: competition.format,
      closedAt: competition.closedAt,
    })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        eq(competition.format, "participation"),
      ),
    )
    .orderBy(asc(competition.name));
}
