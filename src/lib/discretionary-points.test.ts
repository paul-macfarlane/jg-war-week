import { describe, expect, it } from "vitest";

import {
  type DiscretionaryLedgerRow,
  buildDiscretionaryLedger,
  discretionaryLabel,
  parseDiscretionaryInput,
} from "@/lib/discretionary-points";

const targetId = "0f5d6c3e-1b2a-4e8f-9c7d-6a5b4c3d2e1f";

describe("parseDiscretionaryInput", () => {
  it("accepts decimal points and trims the reason", () => {
    expect(
      parseDiscretionaryInput({
        targetId,
        points: "2.5",
        reason: "  Spirit award ",
      }),
    ).toEqual({
      ok: true,
      value: { targetId, points: 2.5, reason: "Spirit award" },
    });
    expect(
      parseDiscretionaryInput({ targetId, points: "-1", reason: "Penalty" }),
    ).toMatchObject({ ok: true, value: { points: -1 } });
  });

  it("needs a reason: blank or only spaces is refused under Reason", () => {
    for (const reason of ["", "   "]) {
      expect(
        parseDiscretionaryInput({ targetId, points: "3", reason }),
      ).toEqual({
        ok: false,
        error: "Give a reason.",
        fieldErrors: { reason: "Give a reason." },
      });
    }
  });

  it("rejects a reason over 500 characters", () => {
    expect(
      parseDiscretionaryInput({
        targetId,
        points: "3",
        reason: "x".repeat(501),
      }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { reason: "Reason must be at most 500 characters." },
    });
  });

  it("rejects missing or non-numeric points, extra decimals and out-of-range values", () => {
    for (const points of ["", "abc", "1e400"]) {
      expect(
        parseDiscretionaryInput({ targetId, points, reason: "r" }).ok,
        points,
      ).toBe(false);
    }
    expect(
      parseDiscretionaryInput({ targetId, points: "1.234", reason: "r" }),
    ).toMatchObject({
      ok: false,
      error: "Points must have at most two decimal places.",
    });
    expect(
      parseDiscretionaryInput({ targetId, points: "1000000", reason: "r" }),
    ).toMatchObject({ ok: false, error: "Points must be at most 999999.99." });
  });

  it("names each refused field", () => {
    expect(
      parseDiscretionaryInput({
        targetId: "nope",
        points: "9999999",
        reason: "",
      }),
    ).toEqual({
      ok: false,
      error: "Choose a Team or Participant.",
      fieldErrors: {
        targetId: "Choose a Team or Participant.",
        points: "Points must be at most 999999.99.",
        reason: "Give a reason.",
      },
    });
  });

  it.each<[string, unknown]>([
    ["{}", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "x"],
  ])("returns an error, not a throw, for %s", (_label, value) => {
    expect(parseDiscretionaryInput(value as never)).toMatchObject({
      ok: false,
    });
  });
});

describe("discretionaryLabel", () => {
  it("reads 'Discretionary: <reason>'", () => {
    expect(discretionaryLabel("Subjective Points")).toBe(
      "Discretionary: Subjective Points",
    );
  });
});

describe("buildDiscretionaryLedger", () => {
  const saved = new Date("2026-09-23T12:00:00Z");
  const row = (
    overrides: Partial<DiscretionaryLedgerRow>,
  ): DiscretionaryLedgerRow => ({
    id: "a",
    teamId: "t-red",
    participantId: null,
    teamName: "Red",
    participantName: null,
    points: 3,
    note: "Spirit",
    enteredByEmail: "o@jahnelgroup.com",
    enteredAt: saved,
    createdAt: saved,
    updatedAt: saved,
    ...overrides,
  });

  it("lists entries newest first with the target's name and reason", () => {
    const ledger = buildDiscretionaryLedger([
      row({ id: "old", enteredAt: new Date("2026-02-24T15:00:00Z") }),
      row({
        id: "new",
        teamId: null,
        participantId: "p-neo",
        participantName: "Neo",
        teamName: null,
        note: "Helped everyone",
      }),
    ]);
    expect(ledger.map((e) => [e.id, e.target, e.targetId, e.reason])).toEqual([
      ["new", "Neo", "p-neo", "Helped everyone"],
      ["old", "Red", "t-red", "Spirit"],
    ]);
  });

  it("marks an entry edited only when its row changed after it was saved, and keeps who entered it", () => {
    const edited = new Date("2026-09-23T12:05:00Z");
    const [changed, seeded] = buildDiscretionaryLedger([
      // A seeded entry: historical enteredAt, row never changed.
      row({ id: "b", enteredAt: new Date("2026-02-24T15:00:00Z") }),
      row({ id: "a", updatedAt: edited }),
    ]).sort((x, y) => x.id.localeCompare(y.id));
    expect(changed.editedAt).toEqual(edited);
    expect(changed.enteredByEmail).toBe("o@jahnelgroup.com");
    expect(changed.enteredAt).toEqual(saved);
    expect(seeded.editedAt).toBeNull();
  });
});
