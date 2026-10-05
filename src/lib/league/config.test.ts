import { describe, expect, it } from "vitest";

import {
  DEFAULT_LEAGUE_CONFIG,
  PAIRING_LABELS,
  leagueConfigOf,
  roundsError,
  roundsOf,
  swissDefaultRounds,
} from "@/lib/league/config";
import { leagueConfigSchema } from "@/lib/league/config-schema";

describe("a new League", () => {
  it("is a round robin with its rounds left blank", () => {
    expect(DEFAULT_LEAGUE_CONFIG).toEqual({
      pairing: "round-robin",
      rounds: null,
    });
  });

  it("labels its Pairings as Organizers read them", () => {
    expect(PAIRING_LABELS).toEqual({
      "round-robin": "Round robin",
      swiss: "Swiss",
    });
  });
});

describe("swissDefaultRounds", () => {
  it.each([
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [8, 3],
    [9, 4],
    [64, 6],
    [65, 7],
  ])("is ⌈log₂ %i⌉ = %i", (entrants, rounds) => {
    expect(swissDefaultRounds(entrants)).toBe(rounds);
  });

  it("is at least 1", () => {
    expect(swissDefaultRounds(1)).toBe(1);
    expect(swissDefaultRounds(0)).toBe(1);
  });
});

describe("roundsOf", () => {
  it("is N − 1 for an even round robin and N for an odd one (one sits out each round)", () => {
    const roundRobin = { pairing: "round-robin", rounds: null } as const;
    expect(roundsOf(roundRobin, 6)).toBe(5);
    expect(roundsOf(roundRobin, 5)).toBe(5);
  });

  it("is a Swiss League's set rounds, or the default when blank", () => {
    expect(roundsOf({ pairing: "swiss", rounds: 5 }, 9)).toBe(5);
    expect(roundsOf({ pairing: "swiss", rounds: null }, 9)).toBe(4);
  });
});

describe("roundsError", () => {
  it("allows a Swiss League 1 to N − 1 rounds", () => {
    expect(roundsError({ pairing: "swiss", rounds: 1 }, 6)).toBeNull();
    expect(roundsError({ pairing: "swiss", rounds: 5 }, 6)).toBeNull();
    expect(roundsError({ pairing: "swiss", rounds: null }, 6)).toBeNull();
  });

  it("refuses more rounds than opponents", () => {
    expect(roundsError({ pairing: "swiss", rounds: 6 }, 6)).toBe(
      "A Swiss League of 6 Entrants plays 1 to 5 rounds.",
    );
  });

  it("has nothing to say about a round robin, or before there are 2 Entrants", () => {
    expect(roundsError({ pairing: "round-robin", rounds: null }, 6)).toBeNull();
    expect(roundsError({ pairing: "swiss", rounds: 4 }, 1)).toBeNull();
  });
});

describe("leagueConfigSchema", () => {
  it("accepts a round robin and a Swiss League with or without rounds", () => {
    for (const config of [
      { pairing: "round-robin", rounds: null },
      { pairing: "swiss", rounds: null },
      { pairing: "swiss", rounds: 4 },
      { pairing: "swiss", rounds: 64 },
    ]) {
      expect(leagueConfigSchema.safeParse(config).success, config.pairing).toBe(
        true,
      );
    }
  });

  it("refuses another Pairing, rounds on a round robin, part rounds and extra keys", () => {
    for (const config of [
      { pairing: "knockout", rounds: null },
      { pairing: "round-robin", rounds: 3 },
      { pairing: "swiss", rounds: 0 },
      { pairing: "swiss", rounds: 2.5 },
      { pairing: "swiss", rounds: 65 },
      { pairing: "swiss", rounds: 1e9 },
      { pairing: "swiss", rounds: null, colors: true },
    ]) {
      expect(
        leagueConfigSchema.safeParse(config).success,
        JSON.stringify(config),
      ).toBe(false);
    }
  });
});

describe("leagueConfigOf", () => {
  it("reads a saved config, and falls back to the default on anything else", () => {
    expect(
      leagueConfigOf({ leagueConfig: { pairing: "swiss", rounds: 3 } }),
    ).toEqual({ pairing: "swiss", rounds: 3 });
    expect(leagueConfigOf({ leagueConfig: null })).toEqual(
      DEFAULT_LEAGUE_CONFIG,
    );
    expect(leagueConfigOf({ leagueConfig: { pairing: "odd" } })).toEqual(
      DEFAULT_LEAGUE_CONFIG,
    );
  });
});
