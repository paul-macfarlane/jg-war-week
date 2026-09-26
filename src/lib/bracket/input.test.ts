import { describe, expect, it } from "vitest";

import {
  parseEntrantsInput,
  parseFormatInput,
  parseGenerateInput,
  parseHeatResultInput,
} from "@/lib/bracket/input";

const a = "8b0a4f0e-2a4e-4c1a-9a57-2f7c7b6f5d11";
const b = "0f5d6c3e-1b2a-4e8f-9c7d-6a5b4c3d2e1f";

describe("Bracket action input", () => {
  it("accepts a Format and refuses an unknown one", () => {
    expect(parseFormatInput({ format: "single-elimination" })).toEqual({
      ok: true,
      value: { format: "single-elimination" },
    });
    expect(parseFormatInput({ format: "swiss" })).toEqual({
      ok: false,
      error: "Choose a Format.",
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
  ];

  it.each(
    parsers.flatMap(([name, parse]) =>
      MALFORMED.map(([label, value]) => [name, label, parse, value] as const),
    ),
  )("%s returns an error for %s", (_name, _label, parse, value) => {
    expect(parse(value)).toMatchObject({ ok: false });
  });

  it.each<[string, (input: unknown) => { ok: boolean }, unknown]>([
    [
      'parseGenerateInput with force: "yes"',
      parseGenerateInput,
      { force: "yes" },
    ],
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
