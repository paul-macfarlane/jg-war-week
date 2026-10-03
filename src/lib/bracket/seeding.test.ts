import { describe, expect, it } from "vitest";

import { shuffleSeedPositions } from "@/lib/bracket/seeding";

describe("shuffleSeedPositions", () => {
  it("shuffles with the given random numbers", () => {
    // Fisher–Yates by hand with every draw 0: [a b c d] → [d b c a] →
    // [c b d a] → [b c d a].
    expect(shuffleSeedPositions(["a", "b", "c", "d"], () => 0)).toEqual([
      { entrantId: "b", seedPosition: 1 },
      { entrantId: "c", seedPosition: 2 },
      { entrantId: "d", seedPosition: 3 },
      { entrantId: "a", seedPosition: 4 },
    ]);
  });

  it("keeps the order when every draw is just under 1", () => {
    expect(
      shuffleSeedPositions(["a", "b", "c"], () => 0.999).map(
        (p) => p.entrantId,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("doesn't change its input", () => {
    const ids = ["a", "b", "c"];
    shuffleSeedPositions(ids, () => 0);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});
