import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import { heatReportError, heatReportState } from "@/lib/bracket/self-report";
import type { Bracket, Entrant } from "@/lib/bracket/types";

const entrants = (count: number): Entrant[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    seedPosition: i + 1,
    label: `E${i + 1}`,
  }));

const newId = (round: number, position: number) => `r${round}h${position}`;

const heat = (bracket: Bracket, id: string) =>
  bracket.heats.find((h) => h.id === id)!;

describe("heatReportState", () => {
  it("single elimination: a bye, an open Heat, an unfilled one, then decided", () => {
    // 3 Entrants: Seed Position 1 has Round 1's bye; 2 v 3 play; the
    // Final waits for them.
    let bracket = generate(DEFAULT_BRACKET_CONFIG, entrants(3), newId);
    const played = bracket.heats.find(
      (h) => h.round === 1 && h.slots.every((s) => s.entrantId !== null),
    )!;
    const bye = bracket.heats.find((h) => h.round === 1 && h.id !== played.id)!;
    const final = bracket.heats.find((h) => h.round === 2)!;

    expect(heatReportState(bracket, bye)).toBe("bye");
    expect(heatReportState(bracket, played)).toBe("open");
    expect(heatReportState(bracket, final)).toBe("unfilled");

    bracket = applyResult(bracket, played.id, { order: ["e2", "e3"] });
    expect(heatReportState(bracket, heat(bracket, played.id))).toBe("decided");
    expect(heatReportState(bracket, heat(bracket, final.id))).toBe("open");
  });

  it("Heats: a bye, an open Heat, an unfilled Round, then decided", () => {
    // 5 Entrants, 4 per Heat, 2 advance: Heats of 3 and 2 (the 2 is a
    // bye), then a Final of 4 waiting for Round 1.
    let bracket = generate(
      { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
      entrants(5),
      newId,
    );
    expect(heatReportState(bracket, heat(bracket, "r1h1"))).toBe("open");
    expect(heatReportState(bracket, heat(bracket, "r1h2"))).toBe("bye");
    expect(heatReportState(bracket, heat(bracket, "r2h1"))).toBe("unfilled");

    const order = heat(bracket, "r1h1").slots.map((s) => s.entrantId!);
    bracket = applyResult(bracket, "r1h1", { order });
    expect(heatReportState(bracket, heat(bracket, "r1h1"))).toBe("decided");
    expect(heatReportState(bracket, heat(bracket, "r2h1"))).toBe("open");
  });
});

describe("heatReportError", () => {
  it("is the access rule's Heat-fact check, re-exported for the mutation", () => {
    expect(
      heatReportError({
        selfReport: true,
        heat: "decided",
        linked: { participantId: "p", teamId: "t", squadId: null },
        entrants: [{ teamId: "t", participantId: null, squadId: null }],
      }),
    ).toBe("This Heat already has a result.");
  });
});
