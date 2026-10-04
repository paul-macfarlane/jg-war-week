import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import { matches } from "@/lib/bracket/groups";
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

/** Each Round as its name and each Match's name and slots. */
function shape(bracket: Bracket) {
  return bracketTree(bracket).rounds.map((round) => [
    round.name,
    round.matches.map((match) => [match.name, match.slots.map(show)]),
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
          ["Round 1 Match 1", ["A>", "bye"]],
          ["Round 1 Match 2", ["D", "E"]],
          ["Round 1 Match 3", ["B>", "bye"]],
          ["Round 1 Match 4", ["C>", "bye"]],
        ],
      ],
      [
        "Semifinal",
        [
          ["Semifinal 1", ["A", "…Round 1 Match 2"]],
          ["Semifinal 2", ["B", "C"]],
        ],
      ],
      ["Final", [["Final", ["…Semifinal 1", "…Semifinal 2"]]]],
    ]);
  });

  it("connects every Match but the Final to the slot its winner fills", () => {
    expect(bracketTree(knockout(["A", "B", "C", "D", "E"])).connectors).toEqual(
      [
        { fromMatchId: "r1h1", toMatchId: "r2h1", toSlot: 0 },
        { fromMatchId: "r1h2", toMatchId: "r2h1", toSlot: 1 },
        { fromMatchId: "r1h3", toMatchId: "r2h2", toSlot: 0 },
        { fromMatchId: "r1h4", toMatchId: "r2h2", toSlot: 1 },
        { fromMatchId: "r2h1", toMatchId: "r3h1", toSlot: 0 },
        { fromMatchId: "r2h2", toMatchId: "r3h1", toSlot: 1 },
      ],
    );
  });

  it("marks byes, and fills in results as Matches are decided", () => {
    let bracket = knockout(["A", "B", "C", "D", "E", "F", "G", "H"]);
    const before = bracketTree(bracket);
    expect(before.rounds[0].matches.map((h) => h.bye)).toEqual([
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
    const [match1] = after.rounds[0].matches;
    expect(match1.decided).toBe(true);
    expect(match1.slots).toEqual([
      {
        kind: "entrant",
        entrantId: "A",
        place: 2,
        score: "1",
        advances: false,
      },
      {
        kind: "entrant",
        entrantId: "H",
        place: 1,
        score: "3",
        advances: true,
      },
    ]);
    expect(after.rounds[1].matches[0].slots.map(show)).toEqual([
      "H",
      "…Round 1 Match 2",
    ]);
  });

  it("names the 8-Entrant Rounds and flags only first-Round byes", () => {
    const five = bracketTree(knockout(["A", "B", "C", "D", "E"]));
    expect(five.rounds.flatMap((r) => r.matches.map((h) => h.bye))).toEqual([
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
    expect(eight.rounds.map((r) => [r.name, r.matches.length])).toEqual([
      ["Round 1", 4],
      ["Semifinal", 2],
      ["Final", 1],
    ]);
    expect(eight.rounds[0].matches.map((h) => h.slots.map(show))).toEqual([
      ["A", "H"],
      ["D", "E"],
      ["B", "G"],
      ["C", "F"],
    ]);
  });
});

describe("bracketTree, Matches", () => {
  /** 8 Entrants, 4 per Match, top 2 advance: two Matches, then the Final. */
  const matches = () =>
    generate(
      {
        kind: "group" as const,
        entrantsPerMatch: 4,
        advancePerMatch: 2,
        thirdPlaceMatch: false,
        rounds: {},
      },
      entrants(["A", "B", "C", "D", "E", "F", "G", "H"]),
      newId,
    );

  it("draws a two-Round Matches Bracket with no connectors, the Final waiting", () => {
    // Dealt snake-style: A, D, E, H to Match 1 and B, C, F, G to Match 2.
    expect(shape(matches())).toEqual([
      [
        "Round 1",
        [
          ["Round 1 Match 1", ["A", "D", "E", "H"]],
          ["Round 1 Match 2", ["B", "C", "F", "G"]],
        ],
      ],
      ["Final", [["Final", ["…Round 1"]]]],
    ]);
    expect(bracketTree(matches()).connectors).toEqual([]);
  });

  it("lists a decided Match by place, highlighting those who advance", () => {
    let bracket = applyResult(matches(), "r1h1", {
      order: ["E", "A", "H", "D"],
    });
    expect(shape(bracket)[0][1]).toEqual([
      ["Round 1 Match 1", ["E>", "A>", "H", "D"]],
      ["Round 1 Match 2", ["B", "C", "F", "G"]],
    ]);
    bracket = applyResult(bracket, "r1h2", { order: ["G", "F", "C", "B"] });
    const final = bracketTree(bracket).rounds[1].matches[0];
    expect(final.slots.map(show).sort()).toEqual(["A", "E", "F", "G"]);

    bracket = applyResult(bracket, "r2h1", { order: ["F", "E", "G", "A"] });
    // In the Final only the winner is highlighted.
    expect(bracketTree(bracket).rounds[1].matches[0].slots.map(show)).toEqual([
      "F>",
      "E",
      "G",
      "A",
    ]);
  });
});

describe("bracketTree, flexible Group Matches", () => {
  it("highlights each Match's own advancing count, and draws Matches of different sizes in one Round", () => {
    // 11 Entrants, 4 per Match, 2 advancing: Matches of 3, 4 and 4.
    let bracket = generate(
      {
        kind: "group" as const,
        entrantsPerMatch: 4,
        advancePerMatch: 2,
        thirdPlaceMatch: false,
        rounds: {},
      },
      entrants(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]),
      newId,
    );
    bracket = matches.setMatchAdvance(bracket, "r1h2", 1, newId);
    bracket = applyResult(bracket, "r1h2", { order: ["H", "B", "E", "K"] });
    const tree = bracketTree(bracket);
    expect(tree.rounds[0].matches.map((m) => m.slots.map(show))).toEqual([
      ["A", "F", "G"],
      ["H>", "B", "E", "K"],
      ["C", "D", "I", "J"],
    ]);
    expect(tree.rounds[0].matches.map((m) => m.advancing)).toEqual([2, 1, 2]);
    // 2 + 1 + 2 = 5 go on: Matches of 3 and 2, the 2 a bye.
    expect(tree.rounds[1].matches.map((m) => [m.slots.length, m.bye])).toEqual([
      [1, false],
      [1, true],
    ]);
  });
});

describe("bracketTree, 3rd place Match", () => {
  it("flags only the final as the final, never the 3rd place Match beside it", () => {
    let bracket = generate(
      { ...DEFAULT_BRACKET_CONFIG, thirdPlaceMatch: true },
      entrants(["A", "B", "C", "D"]),
      newId,
    );
    for (const [id, winner] of [
      ["r1h1", "A"],
      ["r1h2", "B"],
      ["r2h1", "A"],
      ["r2h2", "D"],
    ]) {
      const others = bracket.matches
        .find((h) => h.id === id)!
        .slots.map((s) => s.entrantId!)
        .filter((e) => e !== winner);
      bracket = applyResult(bracket, id, { order: [winner, ...others] });
    }
    const last = bracketTree(bracket).rounds.at(-1)!;
    expect(
      last.matches.map((match) => [
        match.name,
        match.final,
        match.thirdPlace,
        match.slots.map(show),
      ]),
    ).toEqual([
      ["Final", true, false, ["A>", "B"]],
      ["3rd place Match", false, true, ["D>", "C"]],
    ]);
  });
});
