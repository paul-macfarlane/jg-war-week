import { describe, expect, it } from "vitest";

import type { DiscretionaryLedgerEntry } from "@/lib/discretionary-points";
import { toDiscretionaryPointsResult } from "@/mcp/discretionary-points";

const entry = (
  overrides: Partial<DiscretionaryLedgerEntry>,
): DiscretionaryLedgerEntry => ({
  id: "a",
  targetId: "t",
  target: "Red",
  points: 6,
  reason: "Subjective Points",
  enteredByEmail: "organizer@jahnelgroup.com",
  enteredAt: new Date("2026-02-26T15:00:00Z"),
  editedAt: null,
  ...overrides,
});

describe("toDiscretionaryPointsResult", () => {
  it("reports each entry's target, points, reason and time", () => {
    expect(
      toDiscretionaryPointsResult("xi", [
        entry({}),
        entry({
          target: "Neo",
          points: -1.5,
          reason: "Late to the Finale",
          enteredAt: new Date("2026-02-25T12:00:00Z"),
        }),
      ]),
    ).toEqual({
      edition: "xi",
      discretionaryPoints: [
        {
          target: "Red",
          points: 6,
          reason: "Subjective Points",
          enteredAt: "2026-02-26T15:00:00.000Z",
        },
        {
          target: "Neo",
          points: -1.5,
          reason: "Late to the Finale",
          enteredAt: "2026-02-25T12:00:00.000Z",
        },
      ],
    });
  });

  it("carries no email", () => {
    const text = JSON.stringify(toDiscretionaryPointsResult("xi", [entry({})]));
    expect(text).not.toContain("@");
  });
});
