import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import {
  matchReportError,
  matchReportState,
  resultLockReason,
} from "@/lib/bracket/self-report";
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

    // Once the Final has a result, the semifinal it used is locked (D1c);
    // the Final itself is the latest along the path and stays editable.
    bracket = applyResult(bracket, final.id, { order: ["e1", "e2"] });
    expect(matchReportState(bracket, match(bracket, played.id))).toBe(
      "used-later",
    );
    expect(matchReportState(bracket, match(bracket, final.id))).toBe("decided");
  });

  it("with a 3rd place Match, a semifinal is locked by either Match its Entrants went to", () => {
    let bracket = generate(
      { ...DEFAULT_BRACKET_CONFIG, thirdPlaceMatch: true },
      entrants(4),
      newId,
    );
    const [semi1, semi2] = bracket.matches.filter((h) => h.round === 1);
    const order = (id: string) =>
      match(bracket, id).slots.map((s) => s.entrantId!);
    bracket = applyResult(bracket, semi1.id, { order: order(semi1.id) });
    bracket = applyResult(bracket, semi2.id, { order: order(semi2.id) });
    const third = bracket.matches.find((h) => h.thirdPlace)!;
    bracket = applyResult(bracket, third.id, { order: order(third.id) });
    expect(matchReportState(bracket, match(bracket, semi1.id))).toBe(
      "used-later",
    );
    expect(matchReportState(bracket, match(bracket, semi2.id))).toBe(
      "used-later",
    );
  });

  it("Matches: a bye, an open Match, an unfilled Round, then decided", () => {
    // 5 Entrants, 4 per Match, 2 advance: Matches of 3 and 2 (the 2 is a
    // bye), then a Final of 4 waiting for Round 1.
    let bracket = generate(
      {
        kind: "group" as const,
        entrantsPerMatch: 4,
        advancePerMatch: 2,
        thirdPlaceMatch: false,
        rounds: {},
      },
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

    // A Group Match is editable while no later Round has a result (D1c).
    const final = match(bracket, "r2h1").slots.map((s) => s.entrantId!);
    bracket = applyResult(bracket, "r2h1", { order: final });
    expect(matchReportState(bracket, match(bracket, "r1h1"))).toBe(
      "later-round-result",
    );
  });

  it("Group: any result in a later Round locks every earlier Match, even one whose advancers went elsewhere", () => {
    // 16 Entrants, 4 per Match, 2 advance: 4 Matches, then 2, then a Final.
    let bracket = generate(
      {
        kind: "group" as const,
        entrantsPerMatch: 4,
        advancePerMatch: 2,
        thirdPlaceMatch: false,
        rounds: {},
      },
      entrants(16),
      newId,
    );
    const playAsDealt = (id: string) => {
      const order = match(bracket, id).slots.map((s) => s.entrantId!);
      bracket = applyResult(bracket, id, { order });
    };
    for (const id of ["r1h1", "r1h2", "r1h3", "r1h4"]) playAsDealt(id);
    for (const id of ["r1h1", "r1h2", "r1h3", "r1h4"]) {
      expect(matchReportState(bracket, match(bracket, id))).toBe("decided");
    }
    playAsDealt("r2h1");
    const intoSecond = new Set(
      match(bracket, "r2h2").slots.map((s) => s.entrantId),
    );
    const onlyIntoSecond = ["r1h1", "r1h2", "r1h3", "r1h4"].filter((id) =>
      match(bracket, id)
        .slots.filter((s) => s.place !== null && s.place <= 2)
        .every((s) => intoSecond.has(s.entrantId)),
    );
    // At least one Round 1 Match sent its advancers only to the unplayed
    // r2h2: no later Match used its result, but a later Round has one.
    expect(onlyIntoSecond.length).toBeGreaterThan(0);
    for (const id of ["r1h1", "r1h2", "r1h3", "r1h4"]) {
      expect(matchReportState(bracket, match(bracket, id))).toBe(
        "later-round-result",
      );
      expect(resultLockReason(bracket, match(bracket, id))).toBe(
        "A later round already has a result. Change that round first.",
      );
    }
    expect(matchReportState(bracket, match(bracket, "r2h1"))).toBe("decided");
    expect(resultLockReason(bracket, match(bracket, "r2h1"))).toBeNull();
    expect(matchReportState(bracket, match(bracket, "r2h2"))).toBe("open");
  });
});

describe("resultLockReason", () => {
  it("head-to-head keeps the used-later rule and message", () => {
    let bracket = generate(DEFAULT_BRACKET_CONFIG, entrants(4), newId);
    const [semi1, semi2] = bracket.matches.filter((h) => h.round === 1);
    const order = (id: string) =>
      match(bracket, id).slots.map((s) => s.entrantId!);
    bracket = applyResult(bracket, semi1.id, { order: order(semi1.id) });
    expect(resultLockReason(bracket, match(bracket, semi1.id))).toBeNull();
    bracket = applyResult(bracket, semi2.id, { order: order(semi2.id) });
    const final = bracket.matches.find((h) => h.round === 2)!;
    bracket = applyResult(bracket, final.id, { order: order(final.id) });
    expect(resultLockReason(bracket, match(bracket, semi1.id))).toBe(
      "A later Match already used this result. Change that Match first.",
    );
    expect(resultLockReason(bracket, match(bracket, final.id))).toBeNull();
  });
});

describe("matchReportError", () => {
  it("is the access rule's Match-fact check, re-exported for the mutation", () => {
    expect(
      matchReportError({
        selfReport: true,
        match: "used-later",
        linked: { participantId: "p", teamId: "t", squadId: null },
        entrants: [{ teamId: "t", participantId: null, squadId: null }],
      }),
    ).toBe("A later Match already used this result. Change that Match first.");
  });
});
