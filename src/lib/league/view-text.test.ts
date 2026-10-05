import { describe, expect, it } from "vitest";

import {
  byeLine,
  decidedResult,
  matchLine,
  nextMatchText,
  roundsHelp,
  scoresText,
  swapWarningLines,
} from "@/lib/league/view-text";

describe("matchLine", () => {
  it("reads the result as a score line", () => {
    expect(matchLine({ aName: "Ada", bName: "Bo", result: "a" })).toBe(
      "Ada 1–0 Bo",
    );
    expect(matchLine({ aName: "Ada", bName: "Bo", result: "b" })).toBe(
      "Ada 0–1 Bo",
    );
    expect(matchLine({ aName: "Ada", bName: "Bo", result: "draw" })).toBe(
      "Ada ½–½ Bo",
    );
    expect(matchLine({ aName: "Ada", bName: "Bo", result: null })).toBe(
      "Ada v Bo",
    );
  });
});

describe("scoresText", () => {
  it("shows both Scores with the unit, or nothing without any", () => {
    expect(scoresText({ scoreA: 21, scoreB: 18.5, unit: "kg" })).toBe(
      "Scores 21–18.5 kg",
    );
    expect(scoresText({ scoreA: 3, scoreB: null, unit: null })).toBe(
      "Scores 3–?",
    );
    expect(scoresText({ scoreA: null, scoreB: 4, unit: "kg" })).toBe(
      "Scores ?–4 kg",
    );
    expect(scoresText({ scoreA: null, scoreB: null, unit: "kg" })).toBeNull();
  });
});

describe("nextMatchText: Your next Match", () => {
  it("names the round and the opponent, a Swiss bye, or a round-robin sit-out", () => {
    const match = { round: 2, matchId: "m", opponent: "Bo" };
    const none = { ...match, opponent: null };
    expect(nextMatchText(match, "swiss")).toBe("Round 2 · v Bo");
    expect(nextMatchText(none, "swiss")).toBe("Round 2 · You have a bye");
    expect(nextMatchText(none, "round-robin")).toBe("Round 2 · You sit out");
  });
});

describe("byeLine and roundsHelp", () => {
  it("names a Swiss bye and a round-robin sit-out", () => {
    expect(byeLine("Ada", "swiss")).toBe("Ada has a bye");
    expect(byeLine("Ada", "round-robin")).toBe("Ada sits out");
  });

  it("shows the blank default for the Entrants so far", () => {
    expect(roundsHelp(6)).toBe("Blank: ⌈log₂ N⌉, 3 for 6 Entrants.");
    expect(roundsHelp(9)).toBe("Blank: ⌈log₂ N⌉, 4 for 9 Entrants.");
    expect(roundsHelp(0)).toContain("2 or more");
  });
});

describe("swapWarningLines", () => {
  const names: Record<string, string> = { a: "Ada", b: "Bo", c: "Cy" };
  const nameOf = (id: string) => names[id];

  it("names the repeats and the pairs that never meet", () => {
    expect(
      swapWarningLines(
        {
          repeats: [{ a: "a", b: "b" }],
          neverMeet: [{ a: "a", b: "c" }],
          secondByes: [],
        },
        nameOf,
      ),
    ).toEqual(["Ada and Bo would meet twice.", "Ada and Cy would never meet."]);
  });

  it("names an Entrant a Swiss swap gives a second bye", () => {
    expect(
      swapWarningLines(
        { repeats: [], neverMeet: [], secondByes: ["c"] },
        nameOf,
      ),
    ).toEqual(["Cy would have a second bye."]);
  });

  it("is empty when the swap causes neither", () => {
    expect(
      swapWarningLines({ repeats: [], neverMeet: [], secondByes: [] }, nameOf),
    ).toEqual([]);
  });
});

describe("decidedResult", () => {
  it("lets higher or lower Scores decide, equal Scores a draw", () => {
    expect(decidedResult("higher", "21", "18")).toBe("a");
    expect(decidedResult("higher", "18", "21")).toBe("b");
    expect(decidedResult("lower", "18", "21")).toBe("a");
    expect(decidedResult("higher", "5", "5")).toBe("draw");
  });

  it("leaves it to the recorder with no direction or a Score missing", () => {
    expect(decidedResult("none", "21", "18")).toBeNull();
    expect(decidedResult("higher", "21", "")).toBeNull();
    expect(decidedResult("higher", "x", "3")).toBeNull();
  });
});
