import { describe, expect, it } from "vitest";

import type { BracketConfig } from "@/lib/bracket/config";
import { bracketFinaleRows } from "@/lib/bracket/finale";
import {
  applyResult,
  bracketWinner,
  finalPlacings,
  generate,
  isComplete,
  validateConfig,
} from "@/lib/bracket/formats";
import { LATER_MATCH_USED } from "@/lib/bracket/match-report-rule";
import { pointsFor } from "@/lib/bracket/points";
import { bracketTree } from "@/lib/bracket/tree";
import type { Bracket, Entrant, Match } from "@/lib/bracket/types";
import { matchName } from "@/lib/bracket/view";

const withThirdPlace: BracketConfig = {
  kind: "head-to-head" as const,
  entrantsPerMatch: 2,
  advancePerMatch: 1,
  thirdPlaceMatch: true,
  rounds: {},
};
const withoutThirdPlace: BracketConfig = {
  ...withThirdPlace,
  thirdPlaceMatch: false,
};
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

function match(bracket: Bracket, id: string): Match {
  const found = bracket.matches.find((h) => h.id === id);
  if (!found) throw new Error(`no Match ${id}`);
  return found;
}

/** Plays `matchId` with `winner` first. */
function win(bracket: Bracket, matchId: string, winner: string): Bracket {
  const others = match(bracket, matchId)
    .slots.map((s) => s.entrantId!)
    .filter((id) => id !== winner);
  return applyResult(bracket, matchId, { order: [winner, ...others] });
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

describe("Generate with a 3rd place Match", () => {
  it("adds the 3rd place Match beside the final, fed by each semifinal's loser", () => {
    const bracket = generate(withThirdPlace, entrants(8), newId);

    const final = match(bracket, "r3h1");
    const third = match(bracket, "r3h2");
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
    expect(match(bracket, "r2h1").loserTo).toEqual({
      matchId: "r3h2",
      slot: 0,
    });
    expect(match(bracket, "r2h2").loserTo).toEqual({
      matchId: "r3h2",
      slot: 1,
    });
    expect(third.winnerTo).toBeNull();
    expect(match(bracket, "r1h1").loserTo).toBeNull();
    expect(bracket.matches).toHaveLength(8);
  });

  it("has no 3rd place Match without the setting", () => {
    const bracket = generate(withoutThirdPlace, entrants(8), newId);
    expect(bracket.matches.some((h) => h.thirdPlace)).toBe(false);
    expect(bracket.matches.every((h) => h.loserTo === null)).toBe(true);
    expect(bracket.matches).toHaveLength(7);
  });

  it("sends each semifinal's loser to the 3rd place Match", () => {
    const third = match(throughSemifinals(withThirdPlace), "r3h2");
    expect(third.slots.map((s) => s.entrantId)).toEqual(["s4", "s3"]);
    expect(third.status).toBe("ready");
  });

  it("plays 4 Entrants: two semifinals, the final and the 3rd place Match", () => {
    let bracket = generate(withThirdPlace, entrants(4), newId);
    expect(
      bracket.matches.map((h) => [h.id, h.round, h.position, h.thirdPlace]),
    ).toEqual([
      ["r1h1", 1, 1, false],
      ["r1h2", 1, 2, false],
      ["r2h1", 2, 1, false],
      ["r2h2", 2, 2, true],
    ]);
    bracket = win(bracket, "r1h1", "s4");
    bracket = win(bracket, "r1h2", "s2");
    expect(match(bracket, "r2h2").slots.map((s) => s.entrantId)).toEqual([
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

describe("refusing a 3rd place Match", () => {
  it("needs at least 4 Entrants", () => {
    expect(validateConfig(withThirdPlace, 3)).toBe(
      "A 3rd place Match needs at least 4 Entrants.",
    );
    expect(() => generate(withThirdPlace, entrants(3), newId)).toThrow(
      "A 3rd place Match needs at least 4 Entrants.",
    );
    expect(validateConfig(withThirdPlace, 4)).toBeNull();
    expect(validateConfig(withoutThirdPlace, 3)).toBeNull();
  });

  it("is only for 2 per Match with 1 advancing", () => {
    const fourTwo = {
      kind: "group" as const,
      entrantsPerMatch: 4,
      advancePerMatch: 2,
      rounds: {},
    };
    expect(validateConfig({ ...fourTwo, thirdPlaceMatch: true }, 8)).toBe(
      "A 3rd place Match is only for 2 per Match with 1 advancing.",
    );
    expect(() =>
      generate({ ...fourTwo, thirdPlaceMatch: true }, entrants(8), newId),
    ).toThrow("A 3rd place Match is only for 2 per Match with 1 advancing.");
    expect(
      validateConfig({ ...fourTwo, thirdPlaceMatch: false }, 8),
    ).toBeNull();
  });
});

describe("places and points from the final", () => {
  it("8 Entrants with a 3rd place Match: 10, 7, 5, 3 to the four placed", () => {
    let bracket = throughSemifinals(withThirdPlace);
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

  it("8 Entrants without one: only 1st and 2nd are placed and get points", () => {
    const bracket = win(throughSemifinals(withoutThirdPlace), "r3h1", "s2");

    expect(finalPlacings(bracket, entrants(8))).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s1", place: 2 },
    ]);
    expect(
      pointsFor(finalPlacings(bracket, entrants(8)), { placementPoints }),
    ).toEqual([
      { entrantId: "s2", points: 10 },
      { entrantId: "s1", points: 7 },
    ]);
  });

  it("a Matches final of 4 places 1st to 4th in its order, and nobody outside it", () => {
    const config = {
      kind: "group" as const,
      entrantsPerMatch: 4,
      advancePerMatch: 2,
      thirdPlaceMatch: false,
      rounds: {},
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

  it("a Matches final of more than 4 places only its first 4", () => {
    const config = {
      kind: "group" as const,
      entrantsPerMatch: 6,
      advancePerMatch: 1,
      thirdPlaceMatch: false,
      rounds: {},
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

describe("the final, with a 3rd place Match present", () => {
  it("crowns the final's winner, even when the 3rd place Match is recorded last", () => {
    let bracket = throughSemifinals(withThirdPlace);
    bracket = win(bracket, "r3h1", "s2");
    expect(bracketWinner(bracket)).toBe("s2");
    bracket = win(bracket, "r3h2", "s3");
    expect(bracketWinner(bracket)).toBe("s2");
  });

  it("crowns nobody when only the 3rd place Match is recorded", () => {
    const bracket = win(throughSemifinals(withThirdPlace), "r3h2", "s3");
    expect(bracketWinner(bracket)).toBeNull();
  });

  it("isn't complete until both the final and the 3rd place Match are recorded", () => {
    let bracket = throughSemifinals(withThirdPlace);
    expect(isComplete(bracket)).toBe(false);
    bracket = win(bracket, "r3h1", "s2");
    expect(isComplete(bracket)).toBe(false);
    expect(() => finalPlacings(bracket, entrants(8))).toThrow(
      "The Bracket isn't finished yet.",
    );
    bracket = win(bracket, "r3h2", "s3");
    expect(isComplete(bracket)).toBe(true);

    const other = win(throughSemifinals(withThirdPlace), "r3h2", "s3");
    expect(isComplete(other)).toBe(false);
  });

  it("names the Matches Final and 3rd place Match, in the tree too", () => {
    const bracket = generate(withThirdPlace, entrants(8), newId);
    expect(matchName(bracket, match(bracket, "r3h1"))).toBe("Final");
    expect(matchName(bracket, match(bracket, "r3h2"))).toBe("3rd place Match");
    expect(matchName(bracket, match(bracket, "r2h1"))).toBe("Semifinal 1");
    const last = bracketTree(bracket).rounds.at(-1)!;
    expect(last.matches.map((h) => h.name)).toEqual([
      "Final",
      "3rd place Match",
    ]);
  });

  it("a changed semifinal winner sends the new loser to the unplayed 3rd place Match", () => {
    let bracket = throughSemifinals(withThirdPlace);
    bracket = applyResult(bracket, "r2h1", { order: ["s4", "s1"] });
    const third = match(bracket, "r3h2");
    expect(third.slots.map((s) => s.entrantId)).toEqual(["s1", "s3"]);
    expect(third.status).toBe("ready");
    expect(match(bracket, "r3h1").slots.map((s) => s.entrantId)).toEqual([
      "s4",
      "s2",
    ]);
  });

  it("refuses a changed semifinal winner once the 3rd place Match has a result (D1c)", () => {
    const bracket = win(throughSemifinals(withThirdPlace), "r3h2", "s3");
    expect(() => applyResult(bracket, "r2h1", { order: ["s4", "s1"] })).toThrow(
      LATER_MATCH_USED,
    );
    expect(() => applyResult(bracket, "r1h2", { order: ["s5", "s4"] })).toThrow(
      LATER_MATCH_USED,
    );
  });

  it("shows the final as the final in the Finale's rows", () => {
    let bracket = throughSemifinals(withThirdPlace);
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
