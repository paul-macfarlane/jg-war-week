import { describe, expect, it } from "vitest";

import { parseHeatResultInput, parseSquadInput } from "@/lib/bracket/input";

const a = "8b0a4f0e-2a4e-4c1a-9a57-2f7c7b6f5d11";
const b = "0f5d6c3e-1b2a-4e8f-9c7d-6a5b4c3d2e1f";

describe("Bracket action input", () => {
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

  it("refuses an empty finishing order", () => {
    expect(parseHeatResultInput({ order: [] })).toEqual({
      ok: false,
      error: "Put the Match's Entrants in finishing order.",
    });
    expect(parseHeatResultInput({ order: 5 })).toMatchObject({ ok: false });
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
});
