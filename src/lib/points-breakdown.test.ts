import { describe, expect, it } from "vitest";

import { buildPointsBreakdown } from "@/lib/points-breakdown";
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

const tug = {
  id: "c-tug",
  name: "Tug of War",
  scoring: "team",
  countsTowardTeam: false,
} as const;
const chess = {
  id: "c-chess",
  name: "Chess",
  scoring: "individual",
  countsTowardTeam: true,
} as const;
const wellness = {
  id: "c-wellness",
  name: "Wellness",
  scoring: "individual",
  countsTowardTeam: false,
} as const;

type Entry = StandingsPointsEntry & { id: string; enteredAt: Date };

function teamEntry(
  id: string,
  competitionId: string,
  teamId: string,
  points: number,
  enteredAt: Date,
): Entry {
  return { id, competitionId, teamId, participantId: null, points, enteredAt };
}

function participantEntry(
  id: string,
  competitionId: string,
  participantId: string,
  points: number,
  enteredAt: Date,
): Entry {
  return {
    id,
    competitionId,
    teamId: null,
    participantId,
    points,
    enteredAt,
  };
}

const teams = [red, blue];
const participants = [neo, trinity, morpheus];
const competitions = [tug, chess, wellness];

describe("buildPointsBreakdown", () => {
  it("orders a participant's entries newest first with a known worked example", () => {
    const oldest = participantEntry(
      "e1",
      "c-chess",
      "p-neo",
      2,
      new Date("2026-02-01T10:00:00Z"),
    );
    const newest = participantEntry(
      "e2",
      "c-wellness",
      "p-neo",
      5,
      new Date("2026-02-03T10:00:00Z"),
    );

    const { byParticipant } = buildPointsBreakdown({
      teams,
      participants,
      competitions,
      pointsEntries: [oldest, newest],
    });

    expect(byParticipant.get("p-neo")).toEqual([
      { id: "e2", competition: "Wellness", points: 5, when: newest.enteredAt },
      { id: "e1", competition: "Chess", points: 2, when: oldest.enteredAt },
    ]);
  });

  it("credits a Team's direct entries and its Participants' counts-toward-team entries, newest first", () => {
    const direct = teamEntry(
      "e1",
      "c-tug",
      "team-red",
      3,
      new Date("2026-02-01T09:00:00Z"),
    );
    const viaNeo = participantEntry(
      "e2",
      "c-chess",
      "p-neo",
      4,
      new Date("2026-02-02T09:00:00Z"),
    );
    // Doesn't count toward the team: Wellness has countsTowardTeam false.
    const viaNeoExcluded = participantEntry(
      "e3",
      "c-wellness",
      "p-neo",
      9,
      new Date("2026-02-03T09:00:00Z"),
    );

    const { byTeam } = buildPointsBreakdown({
      teams,
      participants,
      competitions,
      pointsEntries: [direct, viaNeo, viaNeoExcluded],
    });

    expect(byTeam.get("team-red")).toEqual([
      { id: "e2", competition: "Chess", points: 4, when: viaNeo.enteredAt },
      {
        id: "e1",
        competition: "Tug of War",
        points: 3,
        when: direct.enteredAt,
      },
    ]);
  });

  it("sums to the same total as computeStandings, for every Participant and Team", () => {
    const entries: Entry[] = [
      teamEntry("e1", "c-tug", "team-red", 3, new Date("2026-02-01T00:00:00Z")),
      teamEntry(
        "e2",
        "c-tug",
        "team-blue",
        6,
        new Date("2026-02-01T01:00:00Z"),
      ),
      participantEntry(
        "e3",
        "c-chess",
        "p-neo",
        4,
        new Date("2026-02-02T00:00:00Z"),
      ),
      participantEntry(
        "e4",
        "c-chess",
        "p-trinity",
        1.5,
        new Date("2026-02-02T01:00:00Z"),
      ),
      participantEntry(
        "e5",
        "c-wellness",
        "p-neo",
        0.2,
        new Date("2026-02-03T00:00:00Z"),
      ),
      participantEntry(
        "e6",
        "c-wellness",
        "p-morpheus",
        0.1,
        new Date("2026-02-03T01:00:00Z"),
      ),
    ];

    const standingsInput: StandingsInput = {
      mode: "teams",
      teams,
      participants,
      competitions,
      pointsEntries: entries,
    };
    const standings = computeStandings(standingsInput);
    const { byParticipant, byTeam } = buildPointsBreakdown({
      teams,
      participants,
      competitions,
      pointsEntries: entries,
    });

    const sum = (rows: { points: number }[] | undefined) =>
      Math.round(
        (rows ?? []).reduce((total, row) => total + row.points, 0) * 100,
      ) / 100;

    for (const row of standings.team) {
      expect(sum(byTeam.get(row.id))).toBe(row.total);
    }
    for (const row of standings.individual) {
      expect(sum(byParticipant.get(row.id))).toBe(row.total);
    }
  });

  it("omits entries for Teams or Participants outside the given input", () => {
    const orphanTeam = teamEntry(
      "e1",
      "c-tug",
      "team-unknown",
      3,
      new Date("2026-02-01T00:00:00Z"),
    );
    const { byTeam } = buildPointsBreakdown({
      teams,
      participants,
      competitions,
      pointsEntries: [orphanTeam],
    });

    expect(byTeam.has("team-unknown")).toBe(false);
  });
});
