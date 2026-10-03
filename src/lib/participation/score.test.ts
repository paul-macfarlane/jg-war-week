import { describe, expect, it } from "vitest";

import { scoreParticipation, teamHeadcounts } from "@/lib/participation/score";

const RED = "team-red";
const BLUE = "team-blue";
const GREEN = "team-green";
const GOLD = "team-gold";

/** A Participant who took part, on `teamId` (null for none). */
const took = (participantId: string, teamId: string | null = null) => ({
  participantId,
  teamId,
});

const sorted = <T extends { points: number }>(entries: T[]) =>
  [...entries].sort(
    (a, b) =>
      b.points - a.points || JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );

describe("scoreParticipation: individual", () => {
  it("gives N to each Participant who took part", () => {
    expect(
      sorted(
        scoreParticipation([took("neo", RED), took("trinity", BLUE)], {
          scoring: "individual",
          participationPoints: 2,
          placementPoints: [10, 6, 3],
        }),
      ),
    ).toEqual([
      { teamId: null, participantId: "neo", points: 2 },
      { teamId: null, participantId: "trinity", points: 2 },
    ]);
  });

  it("scores a Participant with no Team too", () => {
    expect(
      scoreParticipation([took("cypher")], {
        scoring: "individual",
        participationPoints: 1,
        placementPoints: null,
      }),
    ).toEqual([{ teamId: null, participantId: "cypher", points: 1 }]);
  });

  it("gives nothing when nobody took part", () => {
    expect(
      scoreParticipation([], {
        scoring: "individual",
        participationPoints: 1,
        placementPoints: null,
      }),
    ).toEqual([]);
  });
});

describe("scoreParticipation: team, ranked by headcount", () => {
  const ranked = {
    scoring: "team" as const,
    participationPoints: null,
    placementPoints: [5, 3, 1],
  };

  it("ranks Teams by how many took part, by place", () => {
    // Red 3, Blue 2, Green 1.
    expect(
      sorted(
        scoreParticipation(
          [
            took("a", RED),
            took("b", RED),
            took("c", RED),
            took("d", BLUE),
            took("e", BLUE),
            took("f", GREEN),
          ],
          ranked,
        ),
      ),
    ).toEqual([
      { teamId: RED, participantId: null, points: 5 },
      { teamId: BLUE, participantId: null, points: 3 },
      { teamId: GREEN, participantId: null, points: 1 },
    ]);
  });

  it("lets tied Teams share the higher place, and skips the places they fill", () => {
    // Red 3, Blue 3, Green 1: places 1, 1, 3.
    expect(
      sorted(
        scoreParticipation(
          [
            took("a", RED),
            took("b", RED),
            took("c", RED),
            took("d", BLUE),
            took("e", BLUE),
            took("f", BLUE),
            took("g", GREEN),
          ],
          ranked,
        ),
      ),
    ).toEqual([
      { teamId: BLUE, participantId: null, points: 5 },
      { teamId: RED, participantId: null, points: 5 },
      { teamId: GREEN, participantId: null, points: 1 },
    ]);
  });

  it("gives a place without Placement Points nothing, and leaves out Teams with nobody", () => {
    // Red 4, Blue 3, Green 2, Gold 1; only three places have points.
    const entries = scoreParticipation(
      [
        took("a", RED),
        took("b", RED),
        took("c", RED),
        took("d", RED),
        took("e", BLUE),
        took("f", BLUE),
        took("g", BLUE),
        took("h", GREEN),
        took("i", GREEN),
        took("j", GOLD),
      ],
      ranked,
    );
    expect(sorted(entries)).toEqual([
      { teamId: RED, participantId: null, points: 5 },
      { teamId: BLUE, participantId: null, points: 3 },
      { teamId: GREEN, participantId: null, points: 1 },
    ]);
  });

  it("writes nothing without Placement Points", () => {
    expect(
      scoreParticipation([took("a", RED)], {
        ...ranked,
        placementPoints: null,
      }),
    ).toEqual([]);
  });

  it("skips a Participant with no Team", () => {
    expect(scoreParticipation([took("a", RED), took("b")], ranked)).toEqual([
      { teamId: RED, participantId: null, points: 5 },
    ]);
  });
});

describe("teamHeadcounts", () => {
  it("counts each Team's Participants, most first, ties by Team id, skipping no Team", () => {
    expect(
      teamHeadcounts([
        took("a", GREEN),
        took("b", RED),
        took("c", BLUE),
        took("d", RED),
        took("e"),
      ]),
    ).toEqual([
      { teamId: RED, count: 2, place: 1 },
      { teamId: BLUE, count: 1, place: 2 },
      { teamId: GREEN, count: 1, place: 2 },
    ]);
  });
});
