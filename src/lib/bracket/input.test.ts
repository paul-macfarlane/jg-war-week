import { describe, expect, it } from "vitest";

import {
  parseEntrantsInput,
  parseFormatInput,
  parseGenerateInput,
  parseHeatResultInput,
  parseSquadInput,
} from "@/lib/bracket/input";

const a = "8b0a4f0e-2a4e-4c1a-9a57-2f7c7b6f5d11";
const b = "0f5d6c3e-1b2a-4e8f-9c7d-6a5b4c3d2e1f";

describe("Bracket action input", () => {
  it("accepts a Format and refuses an unknown one", () => {
    expect(parseFormatInput({ format: "bracket" })).toEqual({
      ok: true,
      value: { format: "bracket" },
    });
    expect(parseFormatInput({ format: "swiss" })).toEqual({
      ok: false,
      error: "Choose a Format.",
    });
  });

  it("accepts every Format: a Competition changes Format while it has no result", () => {
    for (const format of [
      "placement",
      "bracket",
      "head-to-head",
      "best-score",
      "participation",
    ]) {
      expect(parseFormatInput({ format })).toEqual({
        ok: true,
        value: { format },
      });
    }
  });

  it("accepts a Bracket Format with a valid config", () => {
    expect(
      parseFormatInput({
        format: "bracket",
        config: {
          entrantsPerHeat: 4,
          advancePerHeat: 2,
          thirdPlaceGame: false,
        },
      }),
    ).toEqual({
      ok: true,
      value: {
        format: "bracket",
        config: {
          entrantsPerHeat: 4,
          advancePerHeat: 2,
          thirdPlaceGame: false,
        },
      },
    });
    expect(parseFormatInput({ format: "bracket" })).toEqual({
      ok: true,
      value: { format: "bracket" },
    });
  });

  it("refuses a Bracket config where as many advance as play", () => {
    expect(
      parseFormatInput({
        format: "bracket",
        config: {
          entrantsPerHeat: 4,
          advancePerHeat: 4,
          thirdPlaceGame: false,
        },
      }),
    ).toEqual({ ok: false, error: "Fewer must advance than play in a Heat." });
    expect(
      parseFormatInput({
        format: "bracket",
        config: {
          entrantsPerHeat: 9,
          advancePerHeat: 2,
          thirdPlaceGame: false,
        },
      }),
    ).toEqual({ ok: false, error: "A Heat holds at most 8 Entrants." });
  });

  it("refuses a config for Placement, and a config without its 3rd place game", () => {
    expect(
      parseFormatInput({
        format: "placement",
        config: {
          entrantsPerHeat: 4,
          advancePerHeat: 2,
          thirdPlaceGame: false,
        },
      }),
    ).toEqual({ ok: false, error: "Only a Bracket takes Heat settings." });
    expect(
      parseFormatInput({
        format: "bracket",
        config: { entrantsPerHeat: 4, advancePerHeat: 2 },
      }),
    ).toMatchObject({ ok: false });
  });

  it("accepts a four-Entrant finishing order", () => {
    const c = "3c2b1a0f-9e8d-4c7b-8a69-5f4e3d2c1b0a";
    const d = "7d6c5b4a-3f2e-4d1c-9b0a-8f7e6d5c4b3a";
    expect(parseHeatResultInput({ order: [a, b, c, d] })).toEqual({
      ok: true,
      value: { order: [a, b, c, d] },
    });
  });

  it("trims scores and refuses long ones", () => {
    expect(
      parseHeatResultInput({ order: [a, b], scores: { [a]: " 21 " } }),
    ).toEqual({ ok: true, value: { order: [a, b], scores: { [a]: "21" } } });
    expect(
      parseHeatResultInput({ order: [a, b], scores: { [a]: "x".repeat(41) } }),
    ).toEqual({ ok: false, error: "Scores are at most 40 characters." });
  });

  it("accepts a Generate with no options; seeding is always random", () => {
    expect(parseGenerateInput({})).toEqual({ ok: true, value: {} });
  });

  it("refuses Entrants that aren't row ids", () => {
    expect(parseEntrantsInput({ targetIds: [a, "nope"] })).toEqual({
      ok: false,
      error: "Choose Teams or Participants.",
    });
    expect(parseHeatResultInput({ order: [] })).toEqual({
      ok: false,
      error: "Put the Heat's Entrants in finishing order.",
    });
  });
});

describe("Entrants input kind", () => {
  it("accepts a kind of Entrant, and leaves it out when not given", () => {
    expect(parseEntrantsInput({ kind: "squad", targetIds: [a, b] })).toEqual({
      ok: true,
      value: { kind: "squad", targetIds: [a, b] },
    });
    expect(parseEntrantsInput({ targetIds: [a] })).toEqual({
      ok: true,
      value: { targetIds: [a] },
    });
  });

  it("refuses an unknown kind", () => {
    expect(parseEntrantsInput({ kind: "crew", targetIds: [a] })).toEqual({
      ok: false,
      error: "Choose Teams, Participants or Squads.",
    });
  });
});

describe("parseSquadInput", () => {
  it("trims the name, keeps the Team and drops repeated Participants", () => {
    expect(
      parseSquadInput({
        name: "  Red Alpha ",
        teamId: a,
        participantIds: [a, b, a],
      }),
    ).toEqual({
      ok: true,
      value: { name: "Red Alpha", teamId: a, participantIds: [a, b] },
    });
  });

  it("reads an unchosen Team as none, leaving the Squad rules to say so", () => {
    expect(
      parseSquadInput({ name: "", teamId: "", participantIds: [] }),
    ).toEqual({
      ok: true,
      value: { name: "", teamId: null, participantIds: [] },
    });
  });

  it("names the field of a malformed value", () => {
    expect(
      parseSquadInput({ name: "Red", teamId: "nope", participantIds: [] }),
    ).toEqual({
      ok: false,
      error: "Choose a Team.",
      fieldErrors: { teamId: "Choose a Team." },
    });
    expect(
      parseSquadInput({ name: "Red", teamId: a, participantIds: ["x"] }),
    ).toEqual({
      ok: false,
      error: "Choose Participants.",
      fieldErrors: { participantIds: "Choose Participants." },
    });
    expect(parseSquadInput({ name: 5, teamId: a, participantIds: [] })).toEqual(
      {
        ok: false,
        error: "Enter the Squad's name.",
        fieldErrors: { name: "Enter the Squad's name." },
      },
    );
  });
});

describe("Bracket parsers given a malformed call", () => {
  const MALFORMED: [string, unknown][] = [
    ["{}", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "x"],
    ["a number", 5],
  ];
  const parsers: [string, (input: unknown) => { ok: boolean }][] = [
    ["parseFormatInput", parseFormatInput],
    ["parseEntrantsInput", parseEntrantsInput],
    ["parseHeatResultInput", parseHeatResultInput],
    ["parseSquadInput", parseSquadInput],
  ];

  it.each(
    parsers.flatMap(([name, parse]) =>
      MALFORMED.map(([label, value]) => [name, label, parse, value] as const),
    ),
  )("%s returns an error for %s", (_name, _label, parse, value) => {
    expect(parse(value)).toMatchObject({ ok: false });
  });

  it.each<[string, (input: unknown) => { ok: boolean }, unknown]>([
    ["parseGenerateInput with null", parseGenerateInput, null],
    [
      'parseEntrantsInput with targetIds: "x"',
      parseEntrantsInput,
      { targetIds: "x" },
    ],
    ["parseHeatResultInput with order: 5", parseHeatResultInput, { order: 5 }],
  ])("%s returns an error", (_label, parse, value) => {
    expect(parse(value)).toMatchObject({ ok: false });
  });
});
