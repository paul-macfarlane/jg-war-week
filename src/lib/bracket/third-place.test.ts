import { describe, expect, it } from "vitest";

import type { BracketConfig } from "@/lib/bracket/config";
import { bracketFinaleRows } from "@/lib/bracket/finale";
import {
  applyResult,
  champion,
  finalPlacings,
  generate,
  isComplete,
  resetByResult,
  validateConfig,
} from "@/lib/bracket/formats";
import { pointsFor } from "@/lib/bracket/points";
import { bracketTree } from "@/lib/bracket/tree";
import type { Bracket, Entrant, Heat } from "@/lib/bracket/types";
import { heatName } from "@/lib/bracket/view";

const withGame: BracketConfig = {
  entrantsPerHeat: 2,
  advancePerHeat: 1,
  thirdPlaceGame: true,
};
const withoutGame: BracketConfig = { ...withGame, thirdPlaceGame: false };
const placementPoints = [10, 7, 5, 3];

/** Entrants s1…sN at Seed Positions 1…N. */
function entrants(count: number): Entrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    seedPosition: i + 1,
    label: `S${i + 1}`,
  }));
}

const newId = (round: number, position: number) => `r${round}h${position}`;

function heat(bracket: Bracket, id: string): Heat {
  const found = bracket.heats.find((h) => h.id === id);
  if (!found) throw new Error(`no Heat ${id}`);
  return found;
}

/** Plays `heatId` with `winner` first. */
function win(bracket: Bracket, heatId: string, winner: string): Bracket {
  const others = heat(bracket, heatId)
    .slots.map((s) => s.entrantId!)
    .filter((id) => id !== winner);
  return applyResult(bracket, heatId, { order: [winner, ...others] });
}

/**
 * 8 Entrants through the semifinals: s1, s4, s2 and s3 win Round 1; s1 and
 * s2 win the semifinals, so s4 and s3 lose them.
 */
function throughSemifinals(config: BracketConfig): Bracket {
  let bracket = generate(config, entrants(8), newId);
  for (const [id, winner] of [
    ["r1h1", "s1"],
    ["r1h2", "s4"],
    ["r1h3", "s2"],
    ["r1h4", "s3"],
    ["r2h1", "s1"],
    ["r2h2", "s2"],
  ]) {
    bracket = win(bracket, id, winner);
  }
  return bracket;
}

describe("Generate with a 3rd place game", () => {
  it("adds the 3rd place game beside the final, fed by each semifinal's loser", () => {
    const bracket = generate(withGame, entrants(8), newId);

    const final = heat(bracket, "r3h1");
    const third = heat(bracket, "r3h2");
    expect([final.round, final.position, final.thirdPlace]).toEqual([
      3,
      1,
      false,
    ]);
    expect([third.round, third.position, third.thirdPlace]).toEqual([
      3,
      2,
      true,
    ]);
    expect(heat(bracket, "r2h1").loserTo).toEqual({ heatId: "r3h2", slot: 0 });
    expect(heat(bracket, "r2h2").loserTo).toEqual({ heatId: "r3h2", slot: 1 });
    expect(third.winnerTo).toBeNull();
    expect(heat(bracket, "r1h1").loserTo).toBeNull();
    expect(bracket.heats).toHaveLength(8);
  });

  it("has no 3rd place game without the setting", () => {
    const bracket = generate(withoutGame, entrants(8), newId);
    expect(bracket.heats.some((h) => h.thirdPlace)).toBe(false);
    expect(bracket.heats.every((h) => h.loserTo === null)).toBe(true);
    expect(bracket.heats).toHaveLength(7);
  });

  it("sends each semifinal's loser to the 3rd place game", () => {
    const third = heat(throughSemifinals(withGame), "r3h2");
    expect(third.slots.map((s) => s.entrantId)).toEqual(["s4", "s3"]);
    expect(third.status).toBe("ready");
  });

  it("plays 4 Entrants: two semifinals, the final and the 3rd place game", () => {
    let bracket = generate(withGame, entrants(4), newId);
    expect(
      bracket.heats.map((h) => [h.id, h.round, h.position, h.thirdPlace]),
    ).toEqual([
      ["r1h1", 1, 1, false],
      ["r1h2", 1, 2, false],
      ["r2h1", 2, 1, false],
      ["r2h2", 2, 2, true],
    ]);
    bracket = win(bracket, "r1h1", "s4");
    bracket = win(bracket, "r1h2", "s2");
    expect(heat(bracket, "r2h2").slots.map((s) => s.entrantId)).toEqual([
      "s1",
      "s3",
    ]);
    bracket = win(bracket, "r2h1", "s2");
    bracket = win(bracket, "r2h2", "s3");
    expect(finalPlacings(bracket, entrants(4))).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s4", place: 2 },
      { entrantId: "s3", place: 3 },
      { entrantId: "s1", place: 4 },
    ]);
  });
});

describe("refusing a 3rd place game", () => {
  it("needs at least 4 Entrants", () => {
    expect(validateConfig(withGame, 3)).toBe(
      "A 3rd place game needs at least 4 Entrants.",
    );
    expect(() => generate(withGame, entrants(3), newId)).toThrow(
      "A 3rd place game needs at least 4 Entrants.",
    );
    expect(validateConfig(withGame, 4)).toBeNull();
    expect(validateConfig(withoutGame, 3)).toBeNull();
  });

  it("is only for 2 per Heat with 1 advancing", () => {
    const fourTwo = { entrantsPerHeat: 4, advancePerHeat: 2 };
    expect(validateConfig({ ...fourTwo, thirdPlaceGame: true }, 8)).toBe(
      "A 3rd place game is only for 2 per Heat with 1 advancing.",
    );
    expect(() =>
      generate({ ...fourTwo, thirdPlaceGame: true }, entrants(8), newId),
    ).toThrow("A 3rd place game is only for 2 per Heat with 1 advancing.");
    expect(validateConfig({ ...fourTwo, thirdPlaceGame: false }, 8)).toBeNull();
  });
});

describe("places and points from the final", () => {
  it("8 Entrants with a 3rd place game: 10, 7, 5, 3 to the four placed", () => {
    let bracket = throughSemifinals(withGame);
    bracket = win(bracket, "r3h1", "s2");
    bracket = win(bracket, "r3h2", "s3");

    expect(finalPlacings(bracket, entrants(8))).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s1", place: 2 },
      { entrantId: "s3", place: 3 },
      { entrantId: "s4", place: 4 },
    ]);
    expect(
      pointsFor(finalPlacings(bracket, entrants(8)), { placementPoints }),
    ).toEqual([
      { entrantId: "s2", points: 10 },
      { entrantId: "s1", points: 7 },
      { entrantId: "s3", points: 5 },
      { entrantId: "s4", points: 3 },
    ]);
  });

  it("8 Entrants without one: both semifinal losers get 3rd's points, nobody 4th's", () => {
    const bracket = win(throughSemifinals(withoutGame), "r3h1", "s2");

    expect(finalPlacings(bracket, entrants(8))).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s1", place: 2 },
      { entrantId: "s3", place: 3 },
      { entrantId: "s4", place: 3 },
    ]);
    expect(
      pointsFor(finalPlacings(bracket, entrants(8)), { placementPoints }),
    ).toEqual([
      { entrantId: "s2", points: 10 },
      { entrantId: "s1", points: 7 },
      { entrantId: "s3", points: 5 },
      { entrantId: "s4", points: 5 },
    ]);
  });

  it("a Heats final of 4 places 1st to 4th in its order, and nobody outside it", () => {
    const config = {
      entrantsPerHeat: 4,
      advancePerHeat: 2,
      thirdPlaceGame: false,
    };
    // Round 1 deals s1 s4 s5 s8 and s2 s3 s6 s7.
    let bracket = generate(config, entrants(8), newId);
    bracket = applyResult(bracket, "r1h1", { order: ["s1", "s5", "s4", "s8"] });
    bracket = applyResult(bracket, "r1h2", { order: ["s6", "s2", "s3", "s7"] });
    bracket = applyResult(bracket, "r2h1", { order: ["s5", "s2", "s6", "s1"] });

    expect(finalPlacings(bracket, entrants(8))).toEqual([
      { entrantId: "s5", place: 1 },
      { entrantId: "s2", place: 2 },
      { entrantId: "s6", place: 3 },
      { entrantId: "s1", place: 4 },
    ]);
    expect(
      pointsFor(finalPlacings(bracket, entrants(8)), { placementPoints }),
    ).toEqual([
      { entrantId: "s5", points: 10 },
      { entrantId: "s2", points: 7 },
      { entrantId: "s6", points: 5 },
      { entrantId: "s1", points: 3 },
    ]);
  });

  it("a Heats final of more than 4 places only its first 4", () => {
    const config = {
      entrantsPerHeat: 6,
      advancePerHeat: 1,
      thirdPlaceGame: false,
    };
    const bracket = applyResult(generate(config, entrants(6), newId), "r1h1", {
      order: ["s6", "s5", "s4", "s3", "s2", "s1"],
    });
    expect(finalPlacings(bracket, entrants(6))).toEqual([
      { entrantId: "s6", place: 1 },
      { entrantId: "s5", place: 2 },
      { entrantId: "s4", place: 3 },
      { entrantId: "s3", place: 4 },
    ]);
  });
});

describe("the final, with a 3rd place game present", () => {
  it("crowns the final's winner, even when the 3rd place game is recorded last", () => {
    let bracket = throughSemifinals(withGame);
    bracket = win(bracket, "r3h1", "s2");
    expect(champion(bracket)).toBe("s2");
    bracket = win(bracket, "r3h2", "s3");
    expect(champion(bracket)).toBe("s2");
  });

  it("crowns nobody when only the 3rd place game is recorded", () => {
    const bracket = win(throughSemifinals(withGame), "r3h2", "s3");
    expect(champion(bracket)).toBeNull();
  });

  it("isn't complete until both the final and the 3rd place game are recorded", () => {
    let bracket = throughSemifinals(withGame);
    expect(isComplete(bracket)).toBe(false);
    bracket = win(bracket, "r3h1", "s2");
    expect(isComplete(bracket)).toBe(false);
    expect(() => finalPlacings(bracket, entrants(8))).toThrow(
      "The Bracket isn't finished yet.",
    );
    bracket = win(bracket, "r3h2", "s3");
    expect(isComplete(bracket)).toBe(true);

    const other = win(throughSemifinals(withGame), "r3h2", "s3");
    expect(isComplete(other)).toBe(false);
  });

  it("names the Heats Final and 3rd place game, in the tree too", () => {
    const bracket = generate(withGame, entrants(8), newId);
    expect(heatName(bracket, heat(bracket, "r3h1"))).toBe("Final");
    expect(heatName(bracket, heat(bracket, "r3h2"))).toBe("3rd place game");
    expect(heatName(bracket, heat(bracket, "r2h1"))).toBe("Semifinal 1");
    const last = bracketTree(bracket).rounds.at(-1)!;
    expect(last.heats.map((h) => h.name)).toEqual(["Final", "3rd place game"]);
  });

  it("a changed semifinal winner empties the 3rd place game and sends the new loser", () => {
    let bracket = win(throughSemifinals(withGame), "r3h2", "s3");
    expect(resetByResult(bracket, "r2h1", { order: ["s4", "s1"] })).toEqual([
      "r3h2",
    ]);
    bracket = applyResult(bracket, "r2h1", { order: ["s4", "s1"] });
    const third = heat(bracket, "r3h2");
    expect(third.slots).toEqual([
      { entrantId: "s1", place: null, score: null },
      { entrantId: "s3", place: null, score: null },
    ]);
    expect(third.status).toBe("ready");
    expect(heat(bracket, "r3h1").slots.map((s) => s.entrantId)).toEqual([
      "s4",
      "s2",
    ]);
  });

  it("a changed quarterfinal winner empties a decided semifinal and the 3rd place game its loser reached", () => {
    const bracket = win(throughSemifinals(withGame), "r3h2", "s3");
    expect(resetByResult(bracket, "r1h2", { order: ["s5", "s4"] })).toEqual([
      "r2h1",
      "r3h2",
    ]);
    const next = applyResult(bracket, "r1h2", { order: ["s5", "s4"] });
    expect(heat(next, "r3h2").slots.map((s) => s.entrantId)).toEqual([
      null,
      "s3",
    ]);
    expect(heat(next, "r3h2").status).toBe("pending");
    expect(heat(next, "r2h1").slots.map((s) => s.entrantId)).toEqual([
      "s1",
      "s5",
    ]);
  });

  it("shows the final as the final in the Finale's rows", () => {
    let bracket = throughSemifinals(withGame);
    bracket = win(bracket, "r3h1", "s2");
    bracket = win(bracket, "r3h2", "s3");
    const rows = bracketFinaleRows(
      finalPlacings(bracket, entrants(8)),
      entrants(8).map((e) => ({ ...e, color: null })),
    );
    expect(rows.map((r) => [r.label, r.place])).toEqual([
      ["S2", 1],
      ["S1", 2],
      ["S3", 3],
      ["S4", 4],
    ]);
  });
});
