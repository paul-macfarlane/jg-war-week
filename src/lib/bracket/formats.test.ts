import { describe, expect, it } from "vitest";

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
import type { Entrant } from "@/lib/bracket/types";

const entrants: Entrant[] = [
  { id: "a", seedPosition: 1, label: "A" },
  { id: "b", seedPosition: 2, label: "B" },
  { id: "c", seedPosition: 3, label: "C" },
];

describe("single elimination through the Format dispatch", () => {
  it("generates, records and crowns a champion", () => {
    expect(validateConfig("single-elimination", null, 3)).toBeNull();
    let bracket = generate(
      "single-elimination",
      null,
      entrants,
      (r, p) => `r${r}h${p}`,
    );
    expect(bracket.format).toBe("single-elimination");
    expect(bracket.config).toBeNull();
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

  it("gives single elimination its own engine", () => {
    expect(engineFor("single-elimination").validateConfig(null, 2)).toBeNull();
  });
});

describe("heats through the Format dispatch", () => {
  it("generates, records every Heat and crowns a champion", () => {
    const config = { entrantsPerHeat: 2, advancePerHeat: 1 };
    expect(validateConfig("heats", config, 3)).toBeNull();
    let bracket = generate("heats", config, entrants, (r, p) => `r${r}h${p}`);
    expect(bracket.format).toBe("heats");
    expect(bracket.config).toEqual(config);
    expect(bracket.heats.map((h) => h.slots.length)).toEqual([1, 2, 2]);

    // Seed Position 1 has the one-slot bye into the final.
    const bye = bracket.heats.find((h) => h.id === "r1h1")!;
    expect(isBye(bracket, bye)).toBe(true);
    expect(isRecordable(bracket, "r1h1")).toBe(false);
    expect(isRecordable(bracket, "r1h2")).toBe(true);
    expect(isRecordable(bracket, "r2h1")).toBe(false);
    expect(hasResults(bracket)).toBe(false);

    bracket = applyResult(bracket, "r1h2", { order: ["c", "b"] });
    expect(hasResults(bracket)).toBe(true);
    bracket = applyResult(bracket, "r2h1", { order: ["c", "a"] });
    expect(isComplete(bracket)).toBe(true);
    expect(champion(bracket)).toBe("c");
    expect(finalPlacings(bracket, entrants)).toEqual([
      { entrantId: "c", place: 1 },
      { entrantId: "a", place: 2 },
      { entrantId: "b", place: 3 },
    ]);
    expect(resetByResult(bracket, "r1h2", { order: ["b", "c"] })).toEqual([
      "r2h1",
    ]);
  });
});
