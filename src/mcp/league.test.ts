import { describe, expect, it } from "vitest";

import { toLeagueResult, toNotLeagueResult } from "@/mcp/league";
import type { LeagueView } from "@/queries/league";

const base = {
  teamId: null,
  participantId: null,
  color: null,
  image: null,
};

function view(pairing: "round-robin" | "swiss", closed: boolean): LeagueView {
  const row = {
    played: 1,
    byes: 0,
    headToHead: null,
    sonnebornBerger: null,
    buchholz: null,
    yours: false,
  };
  return {
    competition: {
      id: "c1",
      warWeekId: "w1",
      name: "Chess",
      scoring: "individual",
      config: { pairing, rounds: pairing === "swiss" ? 3 : null },
      scoreDirection: "none",
      scoreUnit: null,
      selfReport: true,
      closed,
      placementPoints: [10, 6, 3],
    },
    roundsTotal: 3,
    roundsPaired: 1,
    swissDefaultRounds: 2,
    entrants: [],
    rounds: [
      {
        round: 1,
        editDisabledReason: null,
        matches: [
          {
            id: "m1",
            round: 1,
            position: 0,
            a: "e1",
            b: "e2",
            result: "a",
            scoreA: null,
            scoreB: null,
            recordedAt: new Date("2027-02-24T15:00:00.000Z"),
            canRecord: true,
            canClear: true,
            yours: true,
          },
          {
            id: "m2",
            round: 1,
            position: 1,
            a: "e3",
            b: null,
            result: null,
            scoreA: null,
            scoreB: null,
            recordedAt: null,
            canRecord: false,
            canClear: false,
            yours: false,
          },
        ],
      },
    ],
    standings: [
      {
        ...base,
        ...row,
        entrantId: "e1",
        name: "Ada Anvil",
        team: "Red",
        wins: 1,
        draws: 0,
        losses: 0,
        matchPoints: 1,
        buchholz: 0,
        headToHead: 1,
        sonnebornBerger: 0,
        rank: 1,
        points: 10,
      },
      {
        ...base,
        ...row,
        entrantId: "e2",
        name: "Bo Beam",
        team: null,
        wins: 0,
        draws: 0,
        losses: 1,
        matchPoints: 0,
        buchholz: 1,
        rank: 2,
        points: 6,
      },
      {
        ...base,
        ...row,
        entrantId: "e3",
        name: "Cy Cog",
        team: null,
        played: 0,
        byes: 1,
        wins: 0,
        draws: 0,
        losses: 0,
        matchPoints: 1,
        rank: 2,
        points: null,
      },
    ],
    provisional: !closed,
    runs: true,
    linked: { participantId: "p1", teamId: null },
    yourEntrantId: "e1",
    yourNextMatch: null,
    offers: {
      pair: null,
      pairNext: null,
      clearPairings: null,
      close: null,
      reopen: null,
    },
  } as unknown as LeagueView;
}

describe("toLeagueResult", () => {
  it("says a League isn't found", () => {
    expect(toLeagueResult(undefined, "Nope")).toMatchObject({ found: false });
  });

  it("serializes a Swiss League with Buchholz, rounds and a bye", () => {
    const result = toLeagueResult(view("swiss", false), "Chess");
    expect(result).toMatchObject({
      found: true,
      competition: {
        name: "Chess",
        format: "League",
        pairing: "swiss",
        rounds: 3,
        roundsPaired: 1,
        scoreDirection: "none",
        selfReport: true,
        closed: false,
      },
    });
    if (!result.found || !("standings" in result)) throw new Error("shape");
    expect(result.standings[0]).toEqual({
      rank: 1,
      name: "Ada Anvil",
      team: "Red",
      wins: 1,
      draws: 0,
      losses: 0,
      byes: 0,
      matchPoints: 1,
      tiebreaks: { buchholz: 0 },
      points: 10,
      provisional: true,
    });
    expect(result.standings[2].points).toBeNull();
    expect(result.standings[2].provisional).toBe(false);
    expect(result.rounds[0].matches).toEqual([
      {
        a: "Ada Anvil",
        b: "Bo Beam",
        result: "a won",
        scoreA: null,
        scoreB: null,
        recordedAt: "2027-02-24T15:00:00.000Z",
      },
      {
        a: "Cy Cog",
        b: null,
        result: null,
        scoreA: null,
        scoreB: null,
        recordedAt: null,
      },
    ]);
  });

  it("gives a round robin head-to-head and Sonneborn-Berger, final once Closed", () => {
    const result = toLeagueResult(view("round-robin", true), "Chess");
    if (!result.found || !("standings" in result)) throw new Error("shape");
    expect(result.competition.pairing).toBe("round robin");
    expect(result.competition.rounds).toBe(3);
    expect(result.standings[0].tiebreaks).toEqual({
      headToHead: 1,
      sonnebornBerger: 0,
    });
    expect(result.standings[0].provisional).toBe(false);
  });

  it("carries no email even when the view does", () => {
    const v = view("swiss", false);
    (v.rounds[0].matches[0] as Record<string, unknown>).recorded_by_email =
      "ada@jahnelgroup.com";
    (v.standings[0] as Record<string, unknown>).email = "ada@jahnelgroup.com";
    const text = JSON.stringify(toLeagueResult(v, "Chess"));
    expect(text).not.toContain("@");
    expect(text.toLowerCase()).not.toContain("email");
  });
});

describe("toNotLeagueResult", () => {
  it("points a Competition run another way at its own tool", () => {
    expect(
      toNotLeagueResult({
        name: "Darts",
        scoring: "individual",
        format: "placement",
      }),
    ).toMatchObject({
      found: true,
      league: null,
      message: expect.stringContaining("get_placements"),
    });
  });
});
