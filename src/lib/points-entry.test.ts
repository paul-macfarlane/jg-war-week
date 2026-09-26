import { describe, expect, it } from "vitest";

import {
  type AdminLedgerRow,
  buildAdminLedger,
  overMaxWarning,
  parsePointsEntryInput,
  pointsEntryTarget,
  pointsEntryTargetError,
} from "@/lib/points-entry";

const competitionId = "8b0a4f0e-2a4e-4c1a-9a57-2f7c7b6f5d11";
const targetId = "0f5d6c3e-1b2a-4e8f-9c7d-6a5b4c3d2e1f";

describe("parsePointsEntryInput", () => {
  it("accepts decimal points, trims the note and drops an empty one", () => {
    const result = parsePointsEntryInput({
      competitionId,
      targetId,
      points: "2.5",
      note: "   ",
    });
    expect(result).toEqual({
      ok: true,
      value: { competitionId, targetId, points: 2.5, note: null },
    });

    const withNote = parsePointsEntryInput({
      competitionId,
      targetId,
      points: "-1",
      note: "  penalty ",
    });
    expect(withNote).toMatchObject({ ok: true, value: { points: -1 } });
    expect(withNote.ok && withNote.value.note).toBe("penalty");
  });

  it("rejects missing or non-numeric points", () => {
    for (const points of ["", "abc", "1e400"]) {
      const result = parsePointsEntryInput({ competitionId, targetId, points });
      expect(result.ok, points).toBe(false);
    }
  });

  it("rejects more than two decimal places and values the column can't hold", () => {
    expect(
      parsePointsEntryInput({ competitionId, targetId, points: "1.234" }),
    ).toEqual({
      ok: false,
      error: "Points must have at most two decimal places.",
    });
    expect(
      parsePointsEntryInput({ competitionId, targetId, points: "1000000" }),
    ).toEqual({ ok: false, error: "Points must be at most 999999.99." });
    expect(
      parsePointsEntryInput({ competitionId, targetId, points: "999999.99" })
        .ok,
    ).toBe(true);
  });

  it("requires a Competition and a target", () => {
    const result = parsePointsEntryInput({
      competitionId: "",
      targetId: "not-a-uuid",
      points: "1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Competition/);
    }
  });

  it("rejects a note over 500 characters", () => {
    expect(
      parsePointsEntryInput({
        competitionId,
        targetId,
        points: "1",
        note: "x".repeat(501),
      }).ok,
    ).toBe(false);
  });
});

describe("pointsEntryTargetError", () => {
  const tug = { name: "Tug of War", scoring: "team" } as const;
  const chess = { name: "Speed Chess", scoring: "individual" } as const;

  it("accepts a Team for a team Competition and a Participant for an individual one", () => {
    expect(pointsEntryTargetError(tug, "team")).toBeNull();
    expect(pointsEntryTargetError(chess, "participant")).toBeNull();
  });

  it("refuses the other kind", () => {
    expect(pointsEntryTargetError(tug, "participant")).toBe(
      '"Tug of War" is a team Competition, so its Points Entries must target a team',
    );
    expect(pointsEntryTargetError(chess, "team")).toBe(
      '"Speed Chess" is an individual Competition, so its Points Entries must target a participant',
    );
  });
});

describe("pointsEntryTarget", () => {
  it("fills exactly one target column", () => {
    expect(pointsEntryTarget("team", "t1")).toEqual({
      teamId: "t1",
      participantId: null,
    });
    expect(pointsEntryTarget("participant", "p1")).toEqual({
      teamId: null,
      participantId: "p1",
    });
  });
});

describe("buildAdminLedger", () => {
  const saved = new Date("2026-09-23T12:00:00Z");
  const row = (overrides: Partial<AdminLedgerRow>): AdminLedgerRow => ({
    id: "a",
    competition: "Tug of War",
    competitionId: "c",
    teamName: "Red",
    participantName: null,
    points: 3,
    note: null,
    enteredByEmail: "o@jahnelgroup.com",
    enteredAt: saved,
    createdAt: saved,
    updatedAt: saved,
    generatedByBracket: false,
    ...overrides,
  });

  it("lists entries newest first with the target's name", () => {
    const ledger = buildAdminLedger([
      row({ id: "old", enteredAt: new Date("2026-02-24T15:00:00Z") }),
      row({ id: "new", participantName: "Neo", teamName: null }),
    ]);
    expect(ledger.map((e) => [e.id, e.target])).toEqual([
      ["new", "Neo"],
      ["old", "Red"],
    ]);
  });

  it("marks an entry edited only when its row changed after it was saved", () => {
    const edited = new Date("2026-09-23T12:05:00Z");
    const [changed, seeded] = buildAdminLedger([
      // A seeded entry: historical enteredAt, row never changed.
      row({ id: "b", enteredAt: new Date("2026-02-24T15:00:00Z") }),
      row({ id: "a", updatedAt: edited }),
    ]).sort((x, y) => x.id.localeCompare(y.id));
    expect(changed.editedAt).toEqual(edited);
    expect(seeded.editedAt).toBeNull();
  });
});

describe("overMaxWarning", () => {
  it("warns only when points exceed a set max", () => {
    expect(overMaxWarning(10, null)).toBeNull();
    expect(overMaxWarning(10, 10)).toBeNull();
    expect(overMaxWarning(10.5, 10)).toBe(
      "10.5 is over this Competition's max of 10 points. It will still save.",
    );
  });

  it("treats a missing or unparseable amount as no warning", () => {
    expect(overMaxWarning(Number.NaN, 5)).toBeNull();
  });
});

describe("parsePointsEntryInput given a malformed call", () => {
  const MALFORMED: [string, unknown][] = [
    ["{}", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "x"],
    ["a number", 5],
  ];
  const valid = {
    competitionId: "7d0f1c1e-3c1b-4a55-9a7e-2d3a4b5c6d7e",
    targetId: "8e1f2d2f-4d2c-4b66-8b8f-3e4b5c6d7e8f",
    points: "5",
  };

  it.each(MALFORMED)("returns an error for %s", (_label, value) => {
    expect(parsePointsEntryInput(value as never)).toMatchObject({ ok: false });
  });

  it.each<[string, Record<string, unknown>]>([
    ["points: 5", { points: 5 }],
    ["points: null", { points: null }],
    ['competitionId: ["x"]', { competitionId: ["x"] }],
    ["targetId: 5", { targetId: 5 }],
    ["note: 5", { note: 5 }],
  ])("returns an error for %s", (_label, overrides) => {
    expect(
      parsePointsEntryInput({ ...valid, ...overrides } as never),
    ).toMatchObject({ ok: false });
  });
});
