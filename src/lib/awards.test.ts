import { describe, expect, it } from "vitest";

import { isAwardId, parseAwardInput } from "@/lib/awards";

const TEAM = "11111111-1111-4111-8111-111111111111";
const ALICE = "22222222-2222-4222-8222-222222222222";
const BOB = "33333333-3333-4333-8333-333333333333";

function input(overrides: Partial<Parameters<typeof parseAwardInput>[0]>) {
  return {
    name: "MVP",
    description: "Most valuable",
    teamId: null,
    participantIds: [ALICE],
    ...overrides,
  };
}

describe("parseAwardInput", () => {
  it("accepts Participant recipients", () => {
    expect(parseAwardInput(input({}))).toEqual({
      ok: true,
      value: {
        name: "MVP",
        description: "Most valuable",
        teamId: null,
        participantIds: [ALICE],
      },
    });
  });

  it("accepts one Team with no Participants, or both", () => {
    expect(
      parseAwardInput(input({ teamId: TEAM, participantIds: [] })).ok,
    ).toBe(true);
    expect(
      parseAwardInput(input({ teamId: TEAM, participantIds: [ALICE, BOB] })).ok,
    ).toBe(true);
  });

  it("refuses an Award with no recipients", () => {
    expect(parseAwardInput(input({ participantIds: [] }))).toEqual({
      ok: false,
      error: "Choose a Team or at least one Participant.",
    });
  });

  it("trims the name and refuses an empty or too-long one", () => {
    const trimmed = parseAwardInput(input({ name: "  MVP  " }));
    expect(trimmed.ok && trimmed.value.name).toBe("MVP");
    expect(parseAwardInput(input({ name: "   " }))).toEqual({
      ok: false,
      error: "Name must not be empty.",
    });
    expect(parseAwardInput(input({ name: "x".repeat(121) }))).toEqual({
      ok: false,
      error: "Name must be at most 120 characters.",
    });
  });

  it("stores a blank description as null and refuses a too-long one", () => {
    const blank = parseAwardInput(input({ description: "  " }));
    expect(blank.ok && blank.value.description).toBeNull();
    expect(parseAwardInput(input({ description: "x".repeat(1001) }))).toEqual({
      ok: false,
      error: "Description must be at most 1000 characters.",
    });
  });

  it("drops duplicate Participants", () => {
    const parsed = parseAwardInput(input({ participantIds: [ALICE, ALICE] }));
    expect(parsed.ok && parsed.value.participantIds).toEqual([ALICE]);
  });

  it("refuses recipient ids that aren't row ids", () => {
    expect(parseAwardInput(input({ teamId: "nope" }))).toEqual({
      ok: false,
      error: "Choose a Team of this War Week.",
    });
    expect(parseAwardInput(input({ participantIds: ["nope"] }))).toEqual({
      ok: false,
      error: "Choose Participants of this War Week.",
    });
  });
});

describe("isAwardId", () => {
  it("accepts a uuid and refuses anything else", () => {
    expect(isAwardId(TEAM)).toBe(true);
    expect(isAwardId("new")).toBe(false);
  });
});

describe("parseAwardInput given a malformed call", () => {
  const MALFORMED: [string, unknown][] = [
    ["{}", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "x"],
    ["a number", 5],
  ];

  it.each(MALFORMED)("returns an error for %s", (_label, value) => {
    expect(parseAwardInput(value as never)).toMatchObject({ ok: false });
  });

  it.each<[string, Record<string, unknown>]>([
    ["name: 5", { name: 5, teamId: null, participantIds: [] }],
    ['participantIds: "x"', { name: "MVP", participantIds: "x" }],
    ["teamId: 5", { name: "MVP", teamId: 5 }],
  ])("returns an error for %s", (_label, value) => {
    expect(parseAwardInput(value as never)).toMatchObject({ ok: false });
  });
});
