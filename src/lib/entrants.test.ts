import { describe, expect, it } from "vitest";

import { pairTargets, sameEntrants } from "./entrants";

describe("sameEntrants", () => {
  it("is the same list of the same kind in any order", () => {
    expect(
      sameEntrants(
        { kind: "team", targetIds: ["a", "b"] },
        { kind: "team", targetIds: ["b", "a"] },
      ),
    ).toBe(true);
  });

  it("differs by a missing or extra Entrant", () => {
    expect(
      sameEntrants(
        { kind: "team", targetIds: ["a", "b"] },
        { kind: "team", targetIds: ["a"] },
      ),
    ).toBe(false);
    expect(
      sameEntrants(
        { kind: "team", targetIds: ["a"] },
        { kind: "team", targetIds: ["a", "c"] },
      ),
    ).toBe(false);
  });

  it("differs by kind when there are Entrants", () => {
    expect(
      sameEntrants(
        { kind: "team", targetIds: ["a"] },
        { kind: "squad", targetIds: ["a"] },
      ),
    ).toBe(false);
  });

  it("treats no Entrants of any kind as the same", () => {
    expect(
      sameEntrants(
        { kind: "team", targetIds: [] },
        { kind: "squad", targetIds: [] },
      ),
    ).toBe(true);
  });
});

describe("pairTargets", () => {
  it("is the pair once both sides are set", () => {
    expect(pairTargets("a", "b")).toEqual(["a", "b"]);
  });

  it("is nothing to save while a side is empty", () => {
    expect(pairTargets("a", "")).toBeNull();
    expect(pairTargets("", "b")).toBeNull();
    expect(pairTargets("", "")).toBeNull();
  });

  it("is nothing to save when both sides are the same Entrant", () => {
    expect(pairTargets("a", "a")).toBeNull();
  });
});
