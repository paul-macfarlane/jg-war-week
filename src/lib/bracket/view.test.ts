import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate as generateFormat } from "@/lib/bracket/formats";
import type { Bracket, Entrant } from "@/lib/bracket/types";
import {
  entrantForYou,
  formatLabel,
  groupRounds,
  heatName,
  isBracketFormat,
  nextHeatFor,
  roundName,
} from "@/lib/bracket/view";

const entrants = (labels: string[]): Entrant[] =>
  labels.map((label, i) => ({ id: label, seedPosition: i + 1, label }));

const newId = (round: number, position: number) => `r${round}h${position}`;

/** A single-elimination Bracket of these Entrants. */
const generate = (list: Entrant[]): Bracket =>
  generateFormat(DEFAULT_BRACKET_CONFIG, list, newId);

/** A Heats Bracket of these Entrants, 4 per Heat, top 2 advancing. */
const generateHeats = (list: Entrant[]): Bracket =>
  generateFormat(
    { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
    list,
    newId,
  );

const letters = (count: number) =>
  Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));

// 5 Entrants: Round 1, Semifinal, Final.
const five = generate(entrants(["A", "B", "C", "D", "E"]));

describe("roundName", () => {
  it("names the last Round the Final and the one before the Semifinal", () => {
    expect(roundName(five, 3)).toBe("Final");
    expect(roundName(five, 2)).toBe("Semifinal");
    expect(roundName(five, 1)).toBe("Round 1");
  });

  it("calls a two-Entrant Bracket's only Round the Final", () => {
    expect(roundName(generate(entrants(["A", "B"])), 1)).toBe("Final");
  });

  it("numbers earlier Rounds from the start", () => {
    expect(roundName(generate(entrants(letters(9))), 2)).toBe("Round 2");
  });

  it("never says Semifinal in a Heats Bracket", () => {
    // 16 Entrants, 4 per Heat, 2 advance: 4 Heats, then 2, then the Final.
    const sixteen = generateHeats(entrants(letters(16)));
    expect(roundName(sixteen, 1)).toBe("Round 1");
    expect(roundName(sixteen, 2)).toBe("Round 2");
    expect(roundName(sixteen, 3)).toBe("Final");
  });
});

describe("heatName", () => {
  it("names Heats by Round and position", () => {
    expect(heatName(five, { round: 3, position: 1 })).toBe("Final");
    expect(heatName(five, { round: 2, position: 2 })).toBe("Semifinal 2");
    expect(heatName(five, { round: 1, position: 4 })).toBe("Round 1 Heat 4");
  });

  it("names a Heats Bracket's Heats by Round and position, the last the Final", () => {
    const sixteen = generateHeats(entrants(letters(16)));
    expect(heatName(sixteen, { round: 1, position: 2 })).toBe("Round 1 Heat 2");
    expect(heatName(sixteen, { round: 2, position: 1 })).toBe("Round 2 Heat 1");
    expect(heatName(sixteen, { round: 3, position: 1 })).toBe("Final");
  });
});

describe("groupRounds", () => {
  it("groups a 5-Entrant Bracket's Heats into named Rounds in order", () => {
    expect(
      groupRounds(five).map((r) => [r.name, r.heats.map((h) => h.id)]),
    ).toEqual([
      ["Round 1", ["r1h1", "r1h2", "r1h3", "r1h4"]],
      ["Semifinal", ["r2h1", "r2h2"]],
      ["Final", ["r3h1"]],
    ]);
  });

  it("has no Rounds before Generate", () => {
    expect(groupRounds({ config: DEFAULT_BRACKET_CONFIG, heats: [] })).toEqual(
      [],
    );
  });
});

describe("nextHeatFor", () => {
  // 3 Entrants: A has a bye into the Final; B plays C in Round 1 Heat 2.
  const three = generate(entrants(["A", "B", "C"]));

  it("waits on the Heat feeding the empty slot after a bye", () => {
    const next = nextHeatFor(three, "A");
    expect(next).toMatchObject({
      kind: "heat",
      heat: { id: "r2h1" },
      opponentIds: [],
    });
    expect(next?.kind === "heat" && next.waitingFor?.id).toBe("r1h2");
  });

  it("names the opponent of a ready Heat", () => {
    const next = nextHeatFor(three, "C");
    expect(next).toMatchObject({
      kind: "heat",
      heat: { id: "r1h2" },
      opponentIds: ["B"],
      waitingFor: null,
    });
  });

  it("finds the opponent once the feeding Heat is decided", () => {
    const played = applyResult(three, "r1h2", { order: ["B", "C"] });
    expect(nextHeatFor(played, "A")).toMatchObject({ opponentIds: ["B"] });
    expect(nextHeatFor(played, "B")).toMatchObject({ heat: { id: "r2h1" } });
  });

  it("has nothing for an eliminated Entrant or after the Final", () => {
    const played = applyResult(three, "r1h2", { order: ["B", "C"] });
    expect(nextHeatFor(played, "C")).toBeNull();
    const done = applyResult(played, "r2h1", { order: ["A", "B"] });
    expect(nextHeatFor(done, "A")).toBeNull();
    expect(nextHeatFor(done, "B")).toBeNull();
  });

  it("has nothing for someone who isn't an Entrant", () => {
    expect(nextHeatFor(three, "Z")).toBeNull();
  });
});

describe("nextHeatFor in a Heats Bracket", () => {
  // 8 Entrants dealt snake-style into two Heats of 4:
  // Round 1 Heat 1 is A, D, E, H; Round 1 Heat 2 is B, C, F, G.
  const eight = generateHeats(entrants(letters(8)));

  it("names every other Entrant of the Heat as an opponent", () => {
    expect(nextHeatFor(eight, "A")).toEqual({
      kind: "heat",
      heat: expect.objectContaining({ id: "r1h1" }),
      opponentIds: ["D", "E", "H"],
      waitingFor: null,
    });
  });

  it("says an Entrant advanced while the rest of their Round is unfinished", () => {
    const played = applyResult(eight, "r1h1", { order: ["D", "A", "E", "H"] });
    expect(nextHeatFor(played, "D")).toEqual({ kind: "advanced", round: 2 });
    expect(nextHeatFor(played, "A")).toEqual({ kind: "advanced", round: 2 });
  });

  it("has nothing for an Entrant who finished below the advancing places", () => {
    const played = applyResult(eight, "r1h1", { order: ["D", "A", "E", "H"] });
    expect(nextHeatFor(played, "E")).toBeNull();
    expect(nextHeatFor(played, "H")).toBeNull();
  });

  it("finds the Final once Round 1 is complete", () => {
    const played = applyResult(
      applyResult(eight, "r1h1", { order: ["D", "A", "E", "H"] }),
      "r1h2",
      { order: ["B", "C", "F", "G"] },
    );
    const next = nextHeatFor(played, "A");
    expect(next).toMatchObject({ kind: "heat", heat: { id: "r2h1" } });
    expect(next?.kind === "heat" && [...next.opponentIds].sort()).toEqual([
      "B",
      "C",
      "D",
    ]);
  });

  it("has nothing once the Final is decided", () => {
    const done = applyResult(
      applyResult(
        applyResult(eight, "r1h1", { order: ["D", "A", "E", "H"] }),
        "r1h2",
        { order: ["B", "C", "F", "G"] },
      ),
      "r2h1",
      { order: ["A", "B", "C", "D"] },
    );
    expect(nextHeatFor(done, "A")).toBeNull();
    expect(nextHeatFor(done, "D")).toBeNull();
  });
});

describe("entrantForYou", () => {
  const list = [
    { id: "e-red", teamId: "red", participantId: null },
    { id: "e-neo", teamId: null, participantId: "neo" },
  ];

  it("is the Participant's own Entrant in an individual Competition", () => {
    expect(
      entrantForYou(
        list,
        { participantId: "neo", teamId: "red" },
        "individual",
      ),
    ).toBe("e-neo");
  });

  it("is the Participant's Team in a team Competition", () => {
    expect(
      entrantForYou(list, { participantId: "neo", teamId: "red" }, "team"),
    ).toBe("e-red");
  });

  it("is null when You aren't known or aren't entered", () => {
    expect(entrantForYou(list, null, "team")).toBeNull();
    expect(
      entrantForYou(list, { participantId: "trin", teamId: null }, "team"),
    ).toBeNull();
    expect(
      entrantForYou(
        list,
        { participantId: "trin", teamId: "blue" },
        "individual",
      ),
    ).toBeNull();
  });
});

describe("entrantForYou with Squads", () => {
  // Red Alpha and Red Bravo are both Red's; Blue Alpha is Blue's.
  const squads = [
    { id: "e-red-alpha", teamId: null, participantId: null, squadId: "ra" },
    { id: "e-red-bravo", teamId: null, participantId: null, squadId: "rb" },
    { id: "e-blue-alpha", teamId: null, participantId: null, squadId: "ba" },
  ];

  it("is Your Squad's Entrant, not the first Squad of Your Team", () => {
    expect(
      entrantForYou(
        squads,
        { participantId: "sam", teamId: "red", squadId: "rb" },
        "team",
      ),
    ).toBe("e-red-bravo");
  });

  it("is null when the Entrants are Squads and You aren't in one", () => {
    expect(
      entrantForYou(
        squads,
        { participantId: "ashley", teamId: "red", squadId: null },
        "team",
      ),
    ).toBeNull();
  });

  it("is null when Your Squad isn't entered", () => {
    expect(
      entrantForYou(
        squads,
        { participantId: "ashley", teamId: "red", squadId: "unentered" },
        "team",
      ),
    ).toBeNull();
  });

  it("falls back to Your Team when the Entrants are Teams, even if You're in a Squad", () => {
    const teams = [
      { id: "e-red", teamId: "red", participantId: null, squadId: null },
      { id: "e-blue", teamId: "blue", participantId: null, squadId: null },
    ];
    expect(
      entrantForYou(
        teams,
        { participantId: "ashley", teamId: "red", squadId: "ra" },
        "team",
      ),
    ).toBe("e-red");
  });
});

describe("formatLabel", () => {
  it("names each Format for Organizers", () => {
    expect(formatLabel("placement")).toBe("Placement");
    expect(formatLabel("bracket")).toBe("Bracket");
    expect(formatLabel("head-to-head")).toBe("Head-to-head");
    expect(formatLabel("best-score")).toBe("Best score");
  });
});

describe("isBracketFormat", () => {
  it("is false for placement, a Games Format or no Format chosen", () => {
    expect(isBracketFormat("placement")).toBe(false);
    expect(isBracketFormat("head-to-head")).toBe(false);
    expect(isBracketFormat("best-score")).toBe(false);
    expect(isBracketFormat(null)).toBe(false);
    expect(isBracketFormat(undefined)).toBe(false);
  });

  it("is true for a Bracket Format", () => {
    expect(isBracketFormat("bracket")).toBe(true);
  });
});
