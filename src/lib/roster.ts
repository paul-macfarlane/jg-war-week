import type { Participant, Team, WarWeek } from "@/db/schema";

export type RosterTeamInput = Pick<Team, "id" | "name" | "color" | "logoUrl">;
export type RosterParticipantInput = Pick<
  Participant,
  "id" | "displayName" | "companyTag" | "teamId" | "isLeader"
> & {
  /** The shown name: the Profile name, else the roster name. */
  displayName: string;
  /** The picture URL, or null for initials. */
  image?: string | null;
};

export type RosterParticipant = Omit<RosterParticipantInput, "teamId">;
export type RosterTeam = RosterTeamInput & {
  participants: RosterParticipant[];
};

export type Roster =
  | { kind: "teams"; teams: RosterTeam[]; unassigned: RosterParticipant[] }
  | { kind: "free-for-all"; participants: RosterParticipant[] };

/**
 * The heading for a War Week's roster: "Participants" in a free-for-all,
 * otherwise the plural Team Label (House → Houses, Tribe → Tribes).
 */
export function rosterHeading(
  mode: WarWeek["mode"],
  teamLabel: string,
): string {
  return mode === "free-for-all" ? "Participants" : `${teamLabel}s`;
}

/** A Team card's Participant count, labelled: "8 Participants", "1 Participant". */
export function participantCountLabel(count: number): string {
  return `${count} ${count === 1 ? "Participant" : "Participants"}`;
}

/** Leaders first, then by display name. */
function byRosterOrder(a: RosterParticipant, b: RosterParticipant): number {
  if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
  return a.displayName.localeCompare(b.displayName);
}

function toRosterParticipant({
  id,
  displayName,
  image,
  companyTag,
  isLeader,
}: RosterParticipantInput): RosterParticipant {
  return { id, displayName, image, companyTag, isLeader };
}

/**
 * Builds the Teams page roster. In `teams` mode each Team (by name) lists
 * its Participants, Leaders first; Participants with no Team are collected
 * in `unassigned`. A free-for-all War Week has one list of every Participant.
 */
export function buildRoster({
  mode,
  teams,
  participants,
}: {
  mode: WarWeek["mode"];
  teams: RosterTeamInput[];
  participants: RosterParticipantInput[];
}): Roster {
  if (mode === "free-for-all") {
    return {
      kind: "free-for-all",
      participants: participants.map(toRosterParticipant).sort(byRosterOrder),
    };
  }

  const teamIds = new Set(teams.map((t) => t.id));
  return {
    kind: "teams",
    teams: [...teams]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => ({
        ...team,
        participants: participants
          .filter((p) => p.teamId === team.id)
          .map(toRosterParticipant)
          .sort(byRosterOrder),
      })),
    unassigned: participants
      .filter((p) => p.teamId === null || !teamIds.has(p.teamId))
      .map(toRosterParticipant)
      .sort(byRosterOrder),
  };
}
