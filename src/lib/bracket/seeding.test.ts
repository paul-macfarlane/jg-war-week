import { describe, expect, it } from "vitest";

import { generate } from "@/lib/bracket/formats";
import {
  type StandingsSeedEntrant,
  shuffleSeedPositions,
  standingsSeedPositions,
} from "@/lib/bracket/seeding";
import type { Entrant } from "@/lib/bracket/types";
import type { Standings } from "@/lib/standings";

/** A minimal Standings with only the rows a test needs. */
function standingsOf(
  team: { id: string; rank: number; total?: number }[],
  individual: { id: string; rank: number; total?: number }[] = [],
): Standings {
  return {
    main: "team",
    team: team.map((t) => ({
      id: t.id,
      name: t.id,
      color: "#000",
      total: t.total ?? 0,
      rank: t.rank,
    })),
    individual: individual.map((p) => ({
      id: p.id,
      name: p.id,
      team: null,
      total: p.total ?? 0,
      rank: p.rank,
    })),
  };
}

const keepOrder = () => 0.999;
const newId = (round: number, position: number) => `r${round}h${position}`;

describe("shuffleSeedPositions", () => {
  it("shuffles with the given random numbers", () => {
    // Fisher–Yates by hand with every draw 0: [a b c d] → [d b c a] →
    // [c b d a] → [b c d a].
    expect(shuffleSeedPositions(["a", "b", "c", "d"], () => 0)).toEqual([
      { entrantId: "b", seedPosition: 1 },
      { entrantId: "c", seedPosition: 2 },
      { entrantId: "d", seedPosition: 3 },
      { entrantId: "a", seedPosition: 4 },
    ]);
  });

  it("keeps the order when every draw is just under 1", () => {
    expect(
      shuffleSeedPositions(["a", "b", "c"], () => 0.999).map(
        (p) => p.entrantId,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("doesn't change its input", () => {
    const ids = ["a", "b", "c"];
    shuffleSeedPositions(ids, () => 0);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("standingsSeedPositions", () => {
  const team = (id: string, teamId: string): StandingsSeedEntrant => ({
    id,
    teamId,
    participantId: null,
  });
  const solo = (id: string, participantId: string): StandingsSeedEntrant => ({
    id,
    teamId: null,
    participantId,
  });

  it("orders Teams by their total in the Team Standings", () => {
    const standings = standingsOf([
      { id: "t1", rank: 2, total: 20 },
      { id: "t2", rank: 1, total: 30 },
      { id: "t3", rank: 3, total: 10 },
    ]);
    const entrants = [team("e1", "t1"), team("e2", "t2"), team("e3", "t3")];

    expect(
      standingsSeedPositions(entrants, standings, "team", keepOrder),
    ).toEqual([
      { entrantId: "e2", seedPosition: 1 },
      { entrantId: "e1", seedPosition: 2 },
      { entrantId: "e3", seedPosition: 3 },
    ]);
  });

  it("orders Participants by their total in the individual Standings", () => {
    const standings = standingsOf(
      [],
      [
        { id: "p1", rank: 2, total: 10 },
        { id: "p2", rank: 1, total: 20 },
      ],
    );
    const entrants = [solo("e1", "p1"), solo("e2", "p2")];

    expect(
      standingsSeedPositions(entrants, standings, "individual", keepOrder),
    ).toEqual([
      { entrantId: "e2", seedPosition: 1 },
      { entrantId: "e1", seedPosition: 2 },
    ]);
  });

  it("shuffles Entrants that share a total among themselves only", () => {
    const standings = standingsOf([
      { id: "t1", rank: 1, total: 10 },
      { id: "t2", rank: 1, total: 10 },
      { id: "t3", rank: 2, total: 5 },
    ]);
    const entrants = [team("e1", "t1"), team("e2", "t2"), team("e3", "t3")];

    // The rank-1 pair [e1, e2] reverses under rng 0 (shuffleSeedPositions);
    // e3, the only rank-2 Entrant, is untouched and comes after.
    expect(
      standingsSeedPositions(entrants, standings, "team", () => 0).map(
        (p) => p.entrantId,
      ),
    ).toEqual(["e2", "e1", "e3"]);
  });

  it("shuffles every zero-point Entrant together, tied at zero", () => {
    const standings = standingsOf([
      { id: "t1", rank: 1, total: 0 },
      { id: "t2", rank: 1, total: 0 },
      { id: "t3", rank: 1, total: 0 },
      { id: "t4", rank: 1, total: 0 },
    ]);
    const entrants = [
      team("e1", "t1"),
      team("e2", "t2"),
      team("e3", "t3"),
      team("e4", "t4"),
    ];

    // Fisher–Yates by hand with every draw 0: [e1 e2 e3 e4] → [e2 e3 e4 e1].
    expect(
      standingsSeedPositions(entrants, standings, "team", () => 0).map(
        (p) => p.entrantId,
      ),
    ).toEqual(["e2", "e3", "e4", "e1"]);
  });

  it("ties a Participant with no entries with a net-0 Participant, above a net-negative one", () => {
    // The individual Standings list only Participants with a Points Entry:
    // p3 has none, so it has no row here, but it isn't "missing" — it
    // scores 0, tying with p1's net-0 row, above p2's net-negative one.
    const standings = standingsOf(
      [],
      [
        { id: "p1", rank: 1, total: 0 },
        { id: "p2", rank: 2, total: -5 },
      ],
    );
    const entrants = [solo("e1", "p1"), solo("e2", "p2"), solo("e3", "p3")];

    const result = standingsSeedPositions(
      entrants,
      standings,
      "individual",
      keepOrder,
    ).map((p) => p.entrantId);

    expect(new Set(result.slice(0, 2))).toEqual(new Set(["e1", "e3"]));
    expect(result[2]).toBe("e2");
  });

  it("puts an Entrant missing from the Standings last, shuffled", () => {
    const standings = standingsOf([
      { id: "t1", rank: 1 },
      { id: "t2", rank: 2 },
    ]);
    // e3 and e4 have no matching Team row in the Standings.
    const entrants = [
      team("e1", "t1"),
      team("e2", "t2"),
      team("e3", "t3"),
      team("e4", "t4"),
    ];

    const result = standingsSeedPositions(
      entrants,
      standings,
      "team",
      keepOrder,
    ).map((p) => p.entrantId);
    expect(result.slice(0, 2)).toEqual(["e1", "e2"]);
    expect(new Set(result.slice(2))).toEqual(new Set(["e3", "e4"]));
  });

  it("seeds a single-elimination Bracket with the top-ranked Entrant at Seed Position 1, byes included", () => {
    const standings = standingsOf([
      { id: "t1", rank: 3, total: 10 },
      { id: "t2", rank: 1, total: 30 },
      { id: "t3", rank: 2, total: 20 },
    ]);
    const entrants = [team("e1", "t1"), team("e2", "t2"), team("e3", "t3")];
    const seeded = standingsSeedPositions(
      entrants,
      standings,
      "team",
      keepOrder,
    );

    const bracketEntrants: Entrant[] = seeded.map(
      ({ entrantId, seedPosition }) => ({
        id: entrantId,
        seedPosition,
        label: entrantId,
      }),
    );
    const bracket = generate(
      "single-elimination",
      null,
      bracketEntrants,
      newId,
    );

    // 3 Entrants: the top Seed Position (the top-ranked Entrant, e2) gets
    // the bye straight into the final.
    const bye = bracket.heats.find((h) => h.id === "r1h1")!;
    expect(bye.slots.map((s) => s.entrantId)).toEqual(["e2", null]);
  });

  it("seeds a Heats Bracket with the top-ranked Entrant at Seed Position 1, byes included", () => {
    const standings = standingsOf([
      { id: "t1", rank: 5, total: 10 },
      { id: "t2", rank: 4, total: 20 },
      { id: "t3", rank: 3, total: 30 },
      { id: "t4", rank: 2, total: 40 },
      { id: "t5", rank: 1, total: 50 },
    ]);
    const entrants = [
      team("e1", "t1"),
      team("e2", "t2"),
      team("e3", "t3"),
      team("e4", "t4"),
      team("e5", "t5"),
    ];
    const seeded = standingsSeedPositions(
      entrants,
      standings,
      "team",
      keepOrder,
    );

    const bracketEntrants: Entrant[] = seeded.map(
      ({ entrantId, seedPosition }) => ({
        id: entrantId,
        seedPosition,
        label: entrantId,
      }),
    );
    const bracket = generate("heats", null, bracketEntrants, newId);

    // The top-ranked Entrant (e5, Seed Position 1) is in the first Round's
    // first Heat.
    const firstHeat = bracket.heats.find(
      (h) => h.round === 1 && h.position === 1,
    )!;
    expect(firstHeat.slots.map((s) => s.entrantId)).toContain("e5");
  });
});
