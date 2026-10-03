import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import { type TreeSlot, bracketTree } from "@/lib/bracket/tree";
import type { Bracket, Entrant } from "@/lib/bracket/types";

const entrants = (labels: string[]): Entrant[] =>
  labels.map((label, i) => ({ id: label, seedPosition: i + 1, label }));

const newId = (round: number, position: number) => `r${round}h${position}`;

/** A single-elimination Bracket of these Entrants, by the real engine. */
const knockout = (labels: string[]): Bracket =>
  generate(DEFAULT_BRACKET_CONFIG, entrants(labels), newId);

/** A slot as a short string: "A", "A>" (advances), "bye", "…Semifinal 1". */
function show(slot: TreeSlot): string {
  switch (slot.kind) {
    case "entrant":
      return `${slot.entrantId}${slot.advances ? ">" : ""}`;
    case "bye":
      return "bye";
    case "waiting":
      return `…${slot.waitingFor}`;
  }
}

/** Each Round as its name and each Heat's name and slots. */
function shape(bracket: Bracket) {
  return bracketTree(bracket).rounds.map((round) => [
    round.name,
    round.heats.map((heat) => [heat.name, heat.slots.map(show)]),
  ]);
}

describe("bracketTree, single elimination", () => {
  it("draws a 2-Entrant Bracket as one Final and no connectors", () => {
    const tree = bracketTree(knockout(["A", "B"]));
    expect(shape(knockout(["A", "B"]))).toEqual([
      ["Final", [["Final", ["A", "B"]]]],
    ]);
    expect(tree.connectors).toEqual([]);
  });

  it("draws a 5-Entrant Bracket with its byes already advanced", () => {
    // Seeds 1, 8, 4, 5, 2, 7, 3, 6 in first-Round order: A, B and C get byes.
    expect(shape(knockout(["A", "B", "C", "D", "E"]))).toEqual([
      [
        "Round 1",
        [
          ["Round 1 Heat 1", ["A>", "bye"]],
          ["Round 1 Heat 2", ["D", "E"]],
          ["Round 1 Heat 3", ["B>", "bye"]],
          ["Round 1 Heat 4", ["C>", "bye"]],
        ],
      ],
      [
        "Semifinal",
        [
          ["Semifinal 1", ["A", "…Round 1 Heat 2"]],
          ["Semifinal 2", ["B", "C"]],
        ],
      ],
      ["Final", [["Final", ["…Semifinal 1", "…Semifinal 2"]]]],
    ]);
  });

  it("connects every Heat but the Final to the slot its winner fills", () => {
    expect(bracketTree(knockout(["A", "B", "C", "D", "E"])).connectors).toEqual(
      [
        { fromHeatId: "r1h1", toHeatId: "r2h1", toSlot: 0 },
        { fromHeatId: "r1h2", toHeatId: "r2h1", toSlot: 1 },
        { fromHeatId: "r1h3", toHeatId: "r2h2", toSlot: 0 },
        { fromHeatId: "r1h4", toHeatId: "r2h2", toSlot: 1 },
        { fromHeatId: "r2h1", toHeatId: "r3h1", toSlot: 0 },
        { fromHeatId: "r2h2", toHeatId: "r3h1", toSlot: 1 },
      ],
    );
  });

  it("marks byes, and fills in results as Heats are decided", () => {
    let bracket = knockout(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const before = bracketTree(bracket);
    expect(before.rounds[0].heats.map((h) => h.bye)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(before.connectors).toHaveLength(6);

    bracket = applyResult(bracket, "r1h1", {
      order: ["H", "A"],
      scores: { H: "3", A: "1" },
    });
    const after = bracketTree(bracket);
    const [heat1] = after.rounds[0].heats;
    expect(heat1.decided).toBe(true);
    expect(heat1.slots).toEqual([
      {
        kind: "entrant",
        entrantId: "A",
        place: 2,
        score: "1",
        forfeited: false,
        advances: false,
      },
      {
        kind: "entrant",
        entrantId: "H",
        place: 1,
        score: "3",
        forfeited: false,
        advances: true,
      },
    ]);
    expect(after.rounds[1].heats[0].slots.map(show)).toEqual([
      "H",
      "…Round 1 Heat 2",
    ]);
  });

  it("names the 8-Entrant Rounds and flags only first-Round byes", () => {
    const five = bracketTree(knockout(["A", "B", "C", "D", "E"]));
    expect(five.rounds.flatMap((r) => r.heats.map((h) => h.bye))).toEqual([
      true,
      false,
      true,
      true,
      false,
      false,
      false,
    ]);
    const eight = bracketTree(
      knockout(["A", "B", "C", "D", "E", "F", "G", "H"]),
    );
    expect(eight.rounds.map((r) => [r.name, r.heats.length])).toEqual([
      ["Round 1", 4],
      ["Semifinal", 2],
      ["Final", 1],
    ]);
    expect(eight.rounds[0].heats.map((h) => h.slots.map(show))).toEqual([
      ["A", "H"],
      ["D", "E"],
      ["B", "G"],
      ["C", "F"],
    ]);
  });
});

describe("bracketTree, Heats", () => {
  /** 8 Entrants, 4 per Heat, top 2 advance: two Heats, then the Final. */
  const heats = () =>
    generate(
      { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
      entrants(["A", "B", "C", "D", "E", "F", "G", "H"]),
      newId,
    );

  it("draws a two-Round Heats Bracket with no connectors, the Final waiting", () => {
    // Dealt snake-style: A, D, E, H to Heat 1 and B, C, F, G to Heat 2.
    expect(shape(heats())).toEqual([
      [
        "Round 1",
        [
          ["Round 1 Heat 1", ["A", "D", "E", "H"]],
          ["Round 1 Heat 2", ["B", "C", "F", "G"]],
        ],
      ],
      ["Final", [["Final", ["…Round 1"]]]],
    ]);
    expect(bracketTree(heats()).connectors).toEqual([]);
  });

  it("lists a decided Heat by place, highlighting those who advance", () => {
    let bracket = applyResult(heats(), "r1h1", { order: ["E", "A", "H", "D"] });
    expect(shape(bracket)[0][1]).toEqual([
      ["Round 1 Heat 1", ["E>", "A>", "H", "D"]],
      ["Round 1 Heat 2", ["B", "C", "F", "G"]],
    ]);
    bracket = applyResult(bracket, "r1h2", { order: ["G", "F", "C", "B"] });
    const final = bracketTree(bracket).rounds[1].heats[0];
    expect(final.slots.map(show).sort()).toEqual(["A", "E", "F", "G"]);

    bracket = applyResult(bracket, "r2h1", { order: ["F", "E", "G", "A"] });
    // In the Final only the winner is highlighted.
    expect(bracketTree(bracket).rounds[1].heats[0].slots.map(show)).toEqual([
      "F>",
      "E",
      "G",
      "A",
    ]);
  });
});
