import type {
  Competition,
  Participant,
  PointsEntry,
  Team,
  WarWeek,
} from "@/db/schema";

export type StandingsTeam = Pick<Team, "id" | "name" | "color">;
export type StandingsParticipant = Pick<
  Participant,
  "id" | "displayName" | "teamId"
> & {
  /** The shown name: the Profile name, else the roster name. */
  displayName: string;
  /** The picture URL, or null for initials. */
  image?: string | null;
};
export type StandingsCompetition = Pick<
  Competition,
  "id" | "scoring" | "countsTowardTeam"
>;
export type StandingsPointsEntry = Pick<
  PointsEntry,
  "competitionId" | "teamId" | "participantId" | "points"
>;

export type StandingsInput = {
  mode: WarWeek["mode"];
  teams: StandingsTeam[];
  participants: StandingsParticipant[];
  competitions: StandingsCompetition[];
  pointsEntries: StandingsPointsEntry[];
};

export type TeamStanding = {
  id: string;
  name: string;
  color: string;
  total: number;
  rank: number;
};

export type IndividualStanding = {
  id: string;
  name: string;
  /** The picture URL; null or absent for initials. */
  image?: string | null;
  team: { name: string; color: string } | null;
  total: number;
  rank: number;
};

export type LeaderboardKind = "team" | "individual";

export type Standings = {
  main: LeaderboardKind;
  team: TeamStanding[];
  individual: IndividualStanding[];
};

/**
 * The one place Standings are computed; every page and MCP tool calls this.
 *
 * - Team total: Points Entries targeting the Team, plus entries targeting its
 *   Participants in individual Competitions with Counts Toward Team on, plus
 *   Discretionary points (no Competition) targeting its Participants.
 * - Individual total: Points Entries targeting the Participant in individual
 *   Competitions, plus Discretionary points targeting them. Only
 *   Participants with at least one such entry are listed.
 * - Main leaderboard: team in `teams` mode, individual in `free-for-all`.
 * - Ordered by total descending (then name, then id); tied totals share a
 *   rank.
 *
 * Points are summed in hundredths (the database stores two decimal places)
 * so fractional totals like 0.1 + 0.2 come out exact.
 */
export function computeStandings(input: StandingsInput): Standings {
  const competitions = new Map(input.competitions.map((c) => [c.id, c]));
  const teams = new Map(input.teams.map((t) => [t.id, t]));
  const participants = new Map(input.participants.map((p) => [p.id, p]));
  const teamHundredths = new Map(input.teams.map((t) => [t.id, 0]));
  const individualHundredths = new Map<string, number>();

  const add = (totals: Map<string, number>, id: string, hundredths: number) =>
    totals.set(id, (totals.get(id) ?? 0) + hundredths);

  for (const entry of input.pointsEntries) {
    const hundredths = Math.round(entry.points * 100);

    if (entry.teamId) {
      if (teamHundredths.has(entry.teamId)) {
        add(teamHundredths, entry.teamId, hundredths);
      }
      continue;
    }

    // No Competition: Discretionary points, which count for the
    // Participant and toward their Team.
    const discretionary = entry.competitionId === null;
    const competition = discretionary
      ? undefined
      : competitions.get(entry.competitionId!);
    const participant = entry.participantId
      ? participants.get(entry.participantId)
      : undefined;
    if (!participant) continue;
    if (!discretionary && competition?.scoring !== "individual") continue;

    add(individualHundredths, participant.id, hundredths);
    if (
      (discretionary || competition?.countsTowardTeam) &&
      participant.teamId &&
      teamHundredths.has(participant.teamId)
    ) {
      add(teamHundredths, participant.teamId, hundredths);
    }
  }

  const team = rank(
    input.teams.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      total: teamHundredths.get(t.id)! / 100,
    })),
  );

  const individual = rank(
    [...individualHundredths].map(([id, hundredths]) => {
      const participant = participants.get(id)!;
      const team = participant.teamId ? teams.get(participant.teamId) : null;
      return {
        id,
        name: participant.displayName,
        image: participant.image ?? null,
        team: team ? { name: team.name, color: team.color } : null,
        total: hundredths / 100,
      };
    }),
  );

  return {
    main: input.mode === "free-for-all" ? "individual" : "team",
    team,
    individual,
  };
}

function rank<T extends { id: string; name: string; total: number }>(
  rows: T[],
): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.total - a.total ||
      a.name.localeCompare(b.name) ||
      // Profile names may collide, so the id keeps the order stable.
      a.id.localeCompare(b.id),
  );
  // A row's rank is one more than the number of rows with a higher total.
  return sorted.map((row) => ({
    ...row,
    rank: sorted.findIndex((r) => r.total === row.total) + 1,
  }));
}
