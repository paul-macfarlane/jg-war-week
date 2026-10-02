import { describe, expect, it } from "vitest";

import {
  type AwardView,
  groupAwardsByCategory,
  parseAwardInput,
} from "@/lib/awards";

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
        categoryId: null,
        participantIds: [ALICE],
      },
    });
  });

  it("takes an optional Category id and refuses a malformed one", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    expect(parseAwardInput(input({ categoryId: id }))).toMatchObject({
      ok: true,
      value: { categoryId: id },
    });
    expect(parseAwardInput(input({ categoryId: "mvp" }))).toMatchObject({
      ok: false,
      fieldErrors: { categoryId: "Choose a Category from the list." },
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
    expect(parseAwardInput(input({ participantIds: [] }))).toMatchObject({
      ok: false,
      error: "Choose a Team or at least one Participant.",
    });
  });

  it("trims the name and refuses an empty or too-long one", () => {
    const trimmed = parseAwardInput(input({ name: "  MVP  " }));
    expect(trimmed.ok && trimmed.value.name).toBe("MVP");
    expect(parseAwardInput(input({ name: "   " }))).toMatchObject({
      ok: false,
      error: "Name must not be empty.",
    });
    expect(parseAwardInput(input({ name: "x".repeat(121) }))).toMatchObject({
      ok: false,
      error: "Name must be at most 120 characters.",
    });
  });

  it("stores a blank description as null and refuses a too-long one", () => {
    const blank = parseAwardInput(input({ description: "  " }));
    expect(blank.ok && blank.value.description).toBeNull();
    expect(
      parseAwardInput(input({ description: "x".repeat(1001) })),
    ).toMatchObject({
      ok: false,
      error: "Description must be at most 1000 characters.",
    });
  });

  it("drops duplicate Participants", () => {
    const parsed = parseAwardInput(input({ participantIds: [ALICE, ALICE] }));
    expect(parsed.ok && parsed.value.participantIds).toEqual([ALICE]);
  });

  it("refuses recipient ids that aren't row ids", () => {
    expect(parseAwardInput(input({ teamId: "nope" }))).toMatchObject({
      ok: false,
      error: "Choose a Team of this War Week.",
    });
    expect(parseAwardInput(input({ participantIds: ["nope"] }))).toMatchObject({
      ok: false,
      error: "Choose Participants of this War Week.",
    });
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

describe("parseAwardInput field errors", () => {
  it("names each refused field, the recipients under participantIds", () => {
    expect(parseAwardInput(input({ name: " ", participantIds: [] }))).toEqual({
      ok: false,
      error: "Name must not be empty.",
      fieldErrors: {
        name: "Name must not be empty.",
        participantIds: "Choose a Team or at least one Participant.",
      },
    });
    expect(parseAwardInput(input({ participantIds: [] }))).toEqual({
      ok: false,
      error: "Choose a Team or at least one Participant.",
      fieldErrors: {
        participantIds: "Choose a Team or at least one Participant.",
      },
    });
  });
});

describe("groupAwardsByCategory", () => {
  const award = (
    name: string,
    category: { id: string; name: string } | null,
  ): AwardView => ({
    id: name,
    name,
    description: null,
    team: null,
    category: category && { ...category, archived: false },
    participants: [],
  });
  const mvp = { id: "c-mvp", name: "War Week MVP" };
  const grow = { id: "c-grow", name: "Grow" };

  it("orders Categories by name and puts the uncategorized last", () => {
    const groups = groupAwardsByCategory([
      award("Catan", null),
      award("MVP 1st Place", mvp),
      award("Grow Award", grow),
      award("MVP 2nd Place", mvp),
    ]);
    expect(
      groups.map((g) => [
        g.category?.name ?? null,
        g.awards.map((a) => a.name),
      ]),
    ).toEqual([
      ["Grow", ["Grow Award"]],
      ["War Week MVP", ["MVP 1st Place", "MVP 2nd Place"]],
      [null, ["Catan"]],
    ]);
  });

  it("is one uncategorized group when no Award has a Category", () => {
    const groups = groupAwardsByCategory([award("A", null), award("B", null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBeNull();
  });

  it("is empty with no Awards", () => {
    expect(groupAwardsByCategory([])).toEqual([]);
  });
});
