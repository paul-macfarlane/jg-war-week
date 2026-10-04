import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import { matchReportError, matchReportState } from "@/lib/bracket/self-report";
import type { Bracket, Entrant } from "@/lib/bracket/types";

const entrants = (count: number): Entrant[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    seedPosition: i + 1,
    label: `E${i + 1}`,
  }));

const newId = (round: number, position: number) => `r${round}h${position}`;

const match = (bracket: Bracket, id: string) =>
  bracket.matches.find((h) => h.id === id)!;

describe("matchReportState", () => {
  it("single elimination: a bye, an open Match, an unfilled one, then decided", () => {
    // 3 Entrants: Seed Position 1 has Round 1's bye; 2 v 3 play; the
    // Final waits for them.
    let bracket = generate(DEFAULT_BRACKET_CONFIG, entrants(3), newId);
    const played = bracket.matches.find(
      (h) => h.round === 1 && h.slots.every((s) => s.entrantId !== null),
    )!;
    const bye = bracket.matches.find(
      (h) => h.round === 1 && h.id !== played.id,
    )!;
    const final = bracket.matches.find((h) => h.round === 2)!;

    expect(matchReportState(bracket, bye)).toBe("bye");
    expect(matchReportState(bracket, played)).toBe("open");
    expect(matchReportState(bracket, final)).toBe("unfilled");

    bracket = applyResult(bracket, played.id, { order: ["e2", "e3"] });
    expect(matchReportState(bracket, match(bracket, played.id))).toBe(
      "decided",
    );
    expect(matchReportState(bracket, match(bracket, final.id))).toBe("open");
  });

  it("Matches: a bye, an open Match, an unfilled Round, then decided", () => {
    // 5 Entrants, 4 per Match, 2 advance: Matches of 3 and 2 (the 2 is a
    // bye), then a Final of 4 waiting for Round 1.
    let bracket = generate(
      { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
      entrants(5),
      newId,
    );
    expect(matchReportState(bracket, match(bracket, "r1h1"))).toBe("open");
    expect(matchReportState(bracket, match(bracket, "r1h2"))).toBe("bye");
    expect(matchReportState(bracket, match(bracket, "r2h1"))).toBe("unfilled");

    const order = match(bracket, "r1h1").slots.map((s) => s.entrantId!);
    bracket = applyResult(bracket, "r1h1", { order });
    expect(matchReportState(bracket, match(bracket, "r1h1"))).toBe("decided");
    expect(matchReportState(bracket, match(bracket, "r2h1"))).toBe("open");
  });
});

describe("matchReportError", () => {
  it("is the access rule's Match-fact check, re-exported for the mutation", () => {
    expect(
      matchReportError({
        selfReport: true,
        match: "decided",
        linked: { participantId: "p", teamId: "t", squadId: null },
        entrants: [{ teamId: "t", participantId: null, squadId: null }],
      }),
    ).toBe("This Match already has a result.");
  });
});
