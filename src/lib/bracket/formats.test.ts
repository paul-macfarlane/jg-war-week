import { describe, expect, it } from "vitest";

import type { BracketConfig } from "@/lib/bracket/config";
import { singleElimination } from "@/lib/bracket/engine";
import {
  applyResult,
  champion,
  engineFor,
  finalPlacings,
  generate,
  hasResults,
  isBye,
  isComplete,
  isRecordable,
  resetByResult,
  validateConfig,
} from "@/lib/bracket/formats";
import { heats } from "@/lib/bracket/heats";
import type { Entrant } from "@/lib/bracket/types";

const config = (
  entrantsPerHeat: number,
  advancePerHeat: number,
): BracketConfig => ({
  entrantsPerHeat,
  advancePerHeat,
  thirdPlaceGame: false,
});

const entrants: Entrant[] = [
  { id: "a", seedPosition: 1, label: "A" },
  { id: "b", seedPosition: 2, label: "B" },
  { id: "c", seedPosition: 3, label: "C" },
];

describe("a 2 per Heat, 1 advancing Bracket through the Format dispatch", () => {
  it("generates, records and crowns a champion", () => {
    expect(validateConfig(config(2, 1), 3)).toBeNull();
    let bracket = generate(config(2, 1), entrants, (r, p) => `r${r}h${p}`);
    expect(bracket.config).toEqual(config(2, 1));
    expect(bracket.heats.map((h) => h.slots.length)).toEqual([2, 2, 2]);

    // Seed Position 1 has the bye into the final.
    const bye = bracket.heats.find((h) => h.id === "r1h1")!;
    expect(isBye(bracket, bye)).toBe(true);
    expect(isRecordable(bracket, "r1h1")).toBe(false);
    expect(isRecordable(bracket, "r1h2")).toBe(true);
    expect(isRecordable(bracket, "r2h1")).toBe(false);
    expect(hasResults(bracket)).toBe(false);

    bracket = applyResult(bracket, "r1h2", { order: ["c", "b"] });
    expect(hasResults(bracket)).toBe(true);
    bracket = applyResult(bracket, "r2h1", { order: ["a", "c"] });
    expect(isComplete(bracket)).toBe(true);
    expect(champion(bracket)).toBe("a");
    expect(finalPlacings(bracket, entrants)).toEqual([
      { entrantId: "a", place: 1 },
      { entrantId: "c", place: 2 },
      { entrantId: "b", place: 3 },
    ]);

    // A new winner in Round 1 clears the decided final; the first
    // non-forfeit is the winner.
    expect(
      resetByResult(bracket, "r1h2", { order: ["c", "b"], forfeits: ["c"] }),
    ).toEqual(["r2h1"]);
    expect(resetByResult(bracket, "r1h2", { order: ["c", "b"] })).toEqual([]);
  });
});

describe("engineFor", () => {
  it("picks the single-elimination engine for 2 per Heat, 1 advancing only", () => {
    expect(engineFor(config(2, 1))).toBe(singleElimination);
    for (let size = 2; size <= 8; size++) {
      for (let advance = 1; advance < size; advance++) {
        if (size === 2 && advance === 1) continue;
        expect(engineFor(config(size, advance))).toBe(heats);
      }
    }
  });
});

describe("a 4 per Heat, 2 advancing Bracket through the Format dispatch", () => {
  const six: Entrant[] = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({
    id,
    seedPosition: i + 1,
    label: id.toUpperCase(),
  }));
  const ids = (heat: { slots: { entrantId: string | null }[] }) =>
    heat.slots.map((s) => s.entrantId);

  it("generates, records every Heat and crowns a champion", () => {
    expect(validateConfig(config(4, 2), 6)).toBeNull();
    let bracket = generate(config(4, 2), six, (r, p) => `r${r}h${p}`);
    expect(bracket.config).toEqual(config(4, 2));
    expect(bracket.heats.map((h) => h.slots.length)).toEqual([3, 3, 4]);
    expect(isRecordable(bracket, "r1h1")).toBe(true);
    expect(isRecordable(bracket, "r2h1")).toBe(false);
    expect(isBye(bracket, bracket.heats[0])).toBe(false);
    expect(hasResults(bracket)).toBe(false);

    const first = ids(bracket.heats[0]) as string[];
    const second = ids(bracket.heats[1]) as string[];
    expect(first).toEqual(["a", "d", "e"]);
    expect(second).toEqual(["b", "c", "f"]);

    bracket = applyResult(bracket, "r1h1", { order: first });
    expect(hasResults(bracket)).toBe(true);
    bracket = applyResult(bracket, "r1h2", { order: second });
    // The top 2 of each Heat go on to the final.
    expect(new Set(ids(bracket.heats[2]))).toEqual(
      new Set(["a", "d", "b", "c"]),
    );
    expect(isRecordable(bracket, "r2h1")).toBe(true);

    bracket = applyResult(bracket, "r2h1", { order: ["b", "a", "c", "d"] });
    expect(isComplete(bracket)).toBe(true);
    expect(champion(bracket)).toBe("b");
    expect(finalPlacings(bracket, six).slice(0, 2)).toEqual([
      { entrantId: "b", place: 1 },
      { entrantId: "a", place: 2 },
    ]);
    expect(resetByResult(bracket, "r1h1", { order: ["d", "a", "e"] })).toEqual([
      "r2h1",
    ]);
  });
});
