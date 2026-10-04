import { describe, expect, it } from "vitest";

import type { BracketConfig } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import { podium } from "@/lib/bracket/podium";
import type { Bracket, Entrant, Heat } from "@/lib/bracket/types";

const knockout: BracketConfig = {
  entrantsPerHeat: 2,
  advancePerHeat: 1,
  thirdPlaceGame: false,
};
const withThirdPlace: BracketConfig = { ...knockout, thirdPlaceGame: true };
const groupOfFour: BracketConfig = {
  entrantsPerHeat: 4,
  advancePerHeat: 2,
  thirdPlaceGame: false,
};

/** Entrants s1…sN at Seed Positions 1…N. */
function entrants(count: number): Entrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    seedPosition: i + 1,
    label: `S${i + 1}`,
  }));
}

/** Each Entrant's own Team, as a Team Bracket's Entrants are. */
function targets(count: number) {
  return entrants(count).map((e) => ({
    id: e.id,
    pointsTeamId: `team-${e.id}`,
    participantId: null,
  }));
}

const newId = (round: number, position: number) => `r${round}h${position}`;

function heat(bracket: Bracket, id: string): Heat {
  const found = bracket.heats.find((h) => h.id === id);
  if (!found) throw new Error(`no Heat ${id}`);
  return found;
}

/** Plays `heatId` in the given order, or with `order[0]` first. */
function play(bracket: Bracket, heatId: string, order: string[]): Bracket {
  const rest = heat(bracket, heatId)
    .slots.map((s) => s.entrantId!)
    .filter((id) => !order.includes(id));
  return applyResult(bracket, heatId, { order: [...order, ...rest] });
}

/** 4 Entrants: s1 beats s4 and s2 beats s3 in the semifinals. */
function semifinalsPlayed(config: BracketConfig): Bracket {
  let bracket = generate(config, entrants(4), newId);
  bracket = play(bracket, "r1h1", ["s1"]);
  bracket = play(bracket, "r1h2", ["s2"]);
  return bracket;
}

const provisional = (bracket: Bracket, placementPoints: number[] | null) =>
  podium({
    bracket,
    entrants: targets(8),
    placementPoints,
    entryPoints: null,
  });

describe("podium", () => {
  it("places nobody before the final is played", () => {
    const bracket = semifinalsPlayed(knockout);
    expect(provisional(bracket, [5, 3, 1])).toEqual([]);
  });

  it("without a 3rd place match places 1st and 2nd only, never the semifinal losers", () => {
    const bracket = play(semifinalsPlayed(knockout), "r2h1", ["s2"]);
    expect(provisional(bracket, [5, 3, 1])).toEqual([
      { entrantId: "s2", place: 1, points: 5 },
      { entrantId: "s1", place: 2, points: 3 },
    ]);
  });

  it("with a 3rd place match places 1st to 4th once both are played", () => {
    let bracket = semifinalsPlayed(withThirdPlace);
    const third = bracket.heats.find((h) => h.thirdPlace)!;
    const final = bracket.heats.find((h) => h.round === 2 && !h.thirdPlace)!;
    bracket = play(bracket, final.id, ["s1"]);
    bracket = play(bracket, third.id, ["s3"]);
    expect(provisional(bracket, [10, 7, 5, 3])).toEqual([
      { entrantId: "s1", place: 1, points: 10 },
      { entrantId: "s2", place: 2, points: 7 },
      { entrantId: "s3", place: 3, points: 5 },
      { entrantId: "s4", place: 4, points: 3 },
    ]);
  });

  it("shows each place once it is decided: the final alone, or the 3rd place match alone", () => {
    const bracket = semifinalsPlayed(withThirdPlace);
    const third = bracket.heats.find((h) => h.thirdPlace)!;
    const final = bracket.heats.find((h) => h.round === 2 && !h.thirdPlace)!;
    expect(provisional(play(bracket, final.id, ["s2"]), [10, 7, 5, 3])).toEqual(
      [
        { entrantId: "s2", place: 1, points: 10 },
        { entrantId: "s1", place: 2, points: 7 },
      ],
    );
    expect(provisional(play(bracket, third.id, ["s4"]), [10, 7, 5, 3])).toEqual(
      [
        { entrantId: "s4", place: 3, points: 5 },
        { entrantId: "s3", place: 4, points: 3 },
      ],
    );
  });

  it("in a Group final, places the final Match's order", () => {
    let bracket = generate(groupOfFour, entrants(4), newId);
    expect(bracket.heats).toHaveLength(1);
    bracket = play(bracket, "r1h1", ["s3", "s1", "s4", "s2"]);
    expect(provisional(bracket, [5, 3, 1])).toEqual([
      { entrantId: "s3", place: 1, points: 5 },
      { entrantId: "s1", place: 2, points: 3 },
      { entrantId: "s4", place: 3, points: 1 },
      { entrantId: "s2", place: 4, points: null },
    ]);
  });

  it("gives every place null points without Placement Points", () => {
    const bracket = play(semifinalsPlayed(knockout), "r2h1", ["s1"]);
    expect(provisional(bracket, null)).toEqual([
      { entrantId: "s1", place: 1, points: null },
      { entrantId: "s2", place: 2, points: null },
    ]);
  });

  it("once Closed, reads each place's points from its Points Entries, not the rule", () => {
    const bracket = play(semifinalsPlayed(knockout), "r2h1", ["s2"]);
    expect(
      podium({
        bracket,
        entrants: targets(4),
        placementPoints: [5, 3, 1],
        entryPoints: [
          { teamId: "team-s2", participantId: null, points: 6 },
          { teamId: "team-s1", participantId: null, points: 2.5 },
          { teamId: "team-s3", participantId: null, points: 1 },
        ],
      }),
    ).toEqual([
      { entrantId: "s2", place: 1, points: 6 },
      { entrantId: "s1", place: 2, points: 2.5 },
    ]);
  });

  it("once Closed, a place with no Points Entry has null points", () => {
    const bracket = play(semifinalsPlayed(knockout), "r2h1", ["s2"]);
    expect(
      podium({
        bracket,
        entrants: targets(4),
        placementPoints: null,
        entryPoints: [],
      }),
    ).toEqual([
      { entrantId: "s2", place: 1, points: null },
      { entrantId: "s1", place: 2, points: null },
    ]);
  });

  it("once Closed, two Squads of one Team each get their own place's points, not the Team's sum", () => {
    let bracket = semifinalsPlayed(withThirdPlace);
    const third = bracket.heats.find((h) => h.thirdPlace)!;
    const final = bracket.heats.find((h) => h.round === 2 && !h.thirdPlace)!;
    bracket = play(bracket, final.id, ["s1"]);
    bracket = play(bracket, third.id, ["s3"]);
    // s1 and s3 are Squads of Team Red; s2 and s4 Participants.
    const squads = [
      { id: "s1", pointsTeamId: "red", participantId: null },
      { id: "s2", pointsTeamId: null, participantId: "p2" },
      { id: "s3", pointsTeamId: "red", participantId: null },
      { id: "s4", pointsTeamId: null, participantId: "p4" },
    ];
    expect(
      podium({
        bracket,
        entrants: squads,
        placementPoints: [10, 7, 5, 3],
        entryPoints: [
          { teamId: "red", participantId: null, points: 5 },
          { teamId: null, participantId: "p2", points: 7 },
          { teamId: "red", participantId: null, points: 10 },
          { teamId: null, participantId: "p4", points: 3 },
        ],
      }),
    ).toEqual([
      { entrantId: "s1", place: 1, points: 10 },
      { entrantId: "s2", place: 2, points: 7 },
      { entrantId: "s3", place: 3, points: 5 },
      { entrantId: "s4", place: 4, points: 3 },
    ]);
  });
});
