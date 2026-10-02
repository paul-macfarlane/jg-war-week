import { describe, expect, it } from "vitest";

import {
  type StandingsInput,
  type StandingsPointsEntry,
  computeStandings,
} from "@/lib/standings";

const red = { id: "team-red", name: "Red", color: "#ff3b3b" };
const blue = { id: "team-blue", name: "Blue", color: "#3b82f6" };

const neo = { id: "p-neo", displayName: "Neo", teamId: red.id };
const trinity = { id: "p-trinity", displayName: "Trinity", teamId: blue.id };
const morpheus = { id: "p-morpheus", displayName: "Morpheus", teamId: null };

const tug = { id: "c-tug", scoring: "team", countsTowardTeam: false } as const;
const chess = {
  id: "c-chess",
  scoring: "individual",
  countsTowardTeam: true,
} as const;
const wellness = {
  id: "c-wellness",
  scoring: "individual",
  countsTowardTeam: false,
} as const;

function teamEntry(
  competitionId: string,
  teamId: string,
  points: number,
): StandingsPointsEntry {
  return { competitionId, teamId, participantId: null, points };
}

function participantEntry(
  competitionId: string,
  participantId: string,
  points: number,
): StandingsPointsEntry {
  return { competitionId, teamId: null, participantId, points };
}

function input(overrides: Partial<StandingsInput>): StandingsInput {
  return {
    mode: "teams",
    teams: [red, blue],
    participants: [neo, trinity, morpheus],
    competitions: [tug, chess, wellness],
    pointsEntries: [],
    ...overrides,
  };
}

type Row = { name: string; total: number; rank: number };

function rows(list: Row[]): Row[] {
  return list.map(({ name, total, rank }) => ({ name, total, rank }));
}

describe("computeStandings", () => {
  const cases: {
    name: string;
    input: StandingsInput;
    main: "team" | "individual";
    team: Row[];
    individual: Row[];
  }[] = [
    {
      name: "team totals made only of team entries",
      input: input({
        pointsEntries: [
          teamEntry(tug.id, red.id, 3),
          teamEntry(tug.id, blue.id, 1),
          teamEntry(tug.id, blue.id, 1),
        ],
      }),
      main: "team",
      team: [
        { name: "Red", total: 3, rank: 1 },
        { name: "Blue", total: 2, rank: 2 },
      ],
      individual: [],
    },
    {
      name: "Participant entries count toward their Team only when Counts Toward Team is on",
      input: input({
        pointsEntries: [
          teamEntry(tug.id, red.id, 1),
          participantEntry(chess.id, trinity.id, 2),
          participantEntry(wellness.id, neo.id, 5),
          participantEntry(chess.id, morpheus.id, 4),
        ],
      }),
      main: "team",
      team: [
        { name: "Blue", total: 2, rank: 1 },
        { name: "Red", total: 1, rank: 2 },
      ],
      individual: [
        { name: "Neo", total: 5, rank: 1 },
        { name: "Morpheus", total: 4, rank: 2 },
        { name: "Trinity", total: 2, rank: 3 },
      ],
    },
    {
      name: "free-for-all makes individual standings the main leaderboard",
      input: input({
        mode: "free-for-all",
        teams: [],
        participants: [
          { ...neo, teamId: null },
          { ...trinity, teamId: null },
        ],
        pointsEntries: [
          participantEntry(chess.id, neo.id, 1),
          participantEntry(chess.id, trinity.id, 3),
        ],
      }),
      main: "individual",
      team: [],
      individual: [
        { name: "Trinity", total: 3, rank: 1 },
        { name: "Neo", total: 1, rank: 2 },
      ],
    },
    {
      name: "fractional points sum without floating-point drift",
      input: input({
        pointsEntries: [
          teamEntry(tug.id, red.id, 0.1),
          teamEntry(tug.id, red.id, 0.2),
          participantEntry(chess.id, neo.id, 1.5),
          teamEntry(tug.id, blue.id, 1.75),
        ],
      }),
      main: "team",
      team: [
        { name: "Red", total: 1.8, rank: 1 },
        { name: "Blue", total: 1.75, rank: 2 },
      ],
      individual: [{ name: "Neo", total: 1.5, rank: 1 }],
    },
    {
      name: "tied totals share a rank and the next rank skips",
      input: input({
        teams: [red, blue, { id: "team-green", name: "Green", color: "#0f0" }],
        pointsEntries: [
          teamEntry(tug.id, red.id, 2),
          teamEntry(tug.id, blue.id, 2),
          teamEntry(tug.id, "team-green", 1),
          participantEntry(chess.id, neo.id, 1),
          participantEntry(chess.id, trinity.id, 1),
        ],
      }),
      main: "team",
      team: [
        { name: "Blue", total: 3, rank: 1 },
        { name: "Red", total: 3, rank: 1 },
        { name: "Green", total: 1, rank: 3 },
      ],
      individual: [
        { name: "Neo", total: 1, rank: 1 },
        { name: "Trinity", total: 1, rank: 1 },
      ],
    },
    {
      name: "no entries: every Team at zero sharing first, no individuals",
      input: input({}),
      main: "team",
      team: [
        { name: "Blue", total: 0, rank: 1 },
        { name: "Red", total: 0, rank: 1 },
      ],
      individual: [],
    },
    {
      name: "a negative entry lowers a Team's and a Participant's total and can reorder ranks",
      input: input({
        pointsEntries: [
          teamEntry(tug.id, red.id, 3),
          teamEntry(tug.id, blue.id, 1),
          teamEntry(tug.id, red.id, -5),
          participantEntry(wellness.id, neo.id, 4),
          participantEntry(wellness.id, trinity.id, 1),
          participantEntry(wellness.id, trinity.id, -2),
        ],
      }),
      main: "team",
      team: [
        { name: "Blue", total: 1, rank: 1 },
        { name: "Red", total: -2, rank: 2 },
      ],
      individual: [
        { name: "Neo", total: 4, rank: 1 },
        { name: "Trinity", total: -1, rank: 2 },
      ],
    },
  ];

  it.each(cases)("$name", ({ input, main, team, individual }) => {
    const standings = computeStandings(input);

    expect(standings.main).toBe(main);
    expect(rows(standings.team)).toEqual(team);
    expect(rows(standings.individual)).toEqual(individual);
  });

  it("carries each Team's color", () => {
    const standings = computeStandings(input({}));

    expect(standings.team.map((row) => row.color)).toEqual([
      blue.color,
      red.color,
    ]);
  });

  it("carries each individual's Team, or null without one", () => {
    const standings = computeStandings(
      input({
        pointsEntries: [
          participantEntry(chess.id, neo.id, 2),
          participantEntry(chess.id, morpheus.id, 1),
        ],
      }),
    );

    expect(standings.individual.map((row) => row.team)).toEqual([
      { name: red.name, color: red.color },
      null,
    ]);
  });

  it("credits Counts Toward Team to a Participant's own total only, adding to no Team when they have none", () => {
    const standings = computeStandings(
      input({
        pointsEntries: [participantEntry(chess.id, morpheus.id, 4)],
      }),
    );

    expect(standings.individual).toEqual([
      expect.objectContaining({ name: "Morpheus", total: 4 }),
    ]);
    expect(standings.team.every((row) => row.total === 0)).toBe(true);
  });
});

describe("computeStandings with resolved names", () => {
  it("breaks a tie on equal totals and equal names by id, and carries the picture", () => {
    const standings = computeStandings({
      mode: "free-for-all",
      teams: [],
      participants: [
        { id: "p-b", displayName: "Sam", teamId: null, image: null },
        {
          id: "p-a",
          displayName: "Sam",
          teamId: null,
          image: "https://images.example.test/a.png",
        },
      ],
      competitions: [
        { id: "c1", scoring: "individual", countsTowardTeam: false },
      ],
      pointsEntries: [
        {
          competitionId: "c1",
          teamId: null,
          participantId: "p-b",
          points: 5,
        },
        {
          competitionId: "c1",
          teamId: null,
          participantId: "p-a",
          points: 5,
        },
      ],
    });

    expect(standings.individual.map((r) => r.id)).toEqual(["p-a", "p-b"]);
    expect(standings.individual.map((r) => r.rank)).toEqual([1, 1]);
    expect(standings.individual[0].image).toBe(
      "https://images.example.test/a.png",
    );
    expect(standings.individual[1].image).toBeNull();
  });
});
