import { describe, expect, it } from "vitest";

import { applyResult, generate } from "@/lib/bracket/engine";
import type { Entrant } from "@/lib/bracket/types";
import {
  entrantForYou,
  formatLabel,
  groupRounds,
  heatName,
  nextHeatFor,
  roundName,
} from "@/lib/bracket/view";

const entrants = (labels: string[]): Entrant[] =>
  labels.map((label, i) => ({ id: label, seedPosition: i + 1, label }));

describe("roundName", () => {
  it("names the last Round the Final and the one before the Semifinal", () => {
    expect(roundName(3, 3)).toBe("Final");
    expect(roundName(2, 3)).toBe("Semifinal");
    expect(roundName(1, 3)).toBe("Round 1");
  });

  it("calls a two-Entrant Bracket's only Round the Final", () => {
    expect(roundName(1, 1)).toBe("Final");
  });

  it("numbers earlier Rounds from the start", () => {
    expect(roundName(2, 4)).toBe("Round 2");
  });
});

describe("heatName", () => {
  it("names Heats by Round and position", () => {
    expect(heatName({ round: 3, position: 1 }, 3)).toBe("Final");
    expect(heatName({ round: 2, position: 2 }, 3)).toBe("Semifinal 2");
    expect(heatName({ round: 1, position: 4 }, 3)).toBe("Round 1 Heat 4");
  });
});

describe("groupRounds", () => {
  it("groups a 5-Entrant Bracket's Heats into named Rounds in order", () => {
    const bracket = generate(entrants(["A", "B", "C", "D", "E"]));
    expect(
      groupRounds(bracket).map((r) => [r.name, r.heats.map((h) => h.id)]),
    ).toEqual([
      ["Round 1", ["r1h1", "r1h2", "r1h3", "r1h4"]],
      ["Semifinal", ["r2h1", "r2h2"]],
      ["Final", ["r3h1"]],
    ]);
  });

  it("has no Rounds before Generate", () => {
    expect(
      groupRounds({ format: "single-elimination", config: null, heats: [] }),
    ).toEqual([]);
  });
});

describe("nextHeatFor", () => {
  // 3 Entrants: A has a bye into the Final; B plays C in Round 1 Heat 2.
  const three = generate(entrants(["A", "B", "C"]));

  it("waits on the Heat feeding the empty slot after a bye", () => {
    const next = nextHeatFor(three, "A");
    expect(next?.heat.id).toBe("r2h1");
    expect(next?.opponentId).toBeNull();
    expect(next?.waitingFor?.id).toBe("r1h2");
  });

  it("names the opponent of a ready Heat", () => {
    const next = nextHeatFor(three, "C");
    expect(next?.heat.id).toBe("r1h2");
    expect(next?.opponentId).toBe("B");
    expect(next?.waitingFor).toBeNull();
  });

  it("finds the opponent once the feeding Heat is decided", () => {
    const played = applyResult(three, "r1h2", { order: ["B", "C"] });
    expect(nextHeatFor(played, "A")?.opponentId).toBe("B");
    expect(nextHeatFor(played, "B")?.heat.id).toBe("r2h1");
  });

  it("has nothing for an eliminated Entrant or after the Final", () => {
    const played = applyResult(three, "r1h2", { order: ["B", "C"] });
    expect(nextHeatFor(played, "C")).toBeNull();
    const done = applyResult(played, "r2h1", { order: ["A", "B"] });
    expect(nextHeatFor(done, "A")).toBeNull();
    expect(nextHeatFor(done, "B")).toBeNull();
  });

  it("has nothing for someone who isn't an Entrant", () => {
    expect(nextHeatFor(three, "Z")).toBeNull();
  });
});

describe("entrantForYou", () => {
  const list = [
    { id: "e-red", teamId: "red", participantId: null },
    { id: "e-neo", teamId: null, participantId: "neo" },
  ];

  it("is the Participant's own Entrant in an individual Competition", () => {
    expect(
      entrantForYou(
        list,
        { participantId: "neo", teamId: "red" },
        "individual",
      ),
    ).toBe("e-neo");
  });

  it("is the Participant's Team in a team Competition", () => {
    expect(
      entrantForYou(list, { participantId: "neo", teamId: "red" }, "team"),
    ).toBe("e-red");
  });

  it("is null when You aren't known or aren't entered", () => {
    expect(entrantForYou(list, null, "team")).toBeNull();
    expect(
      entrantForYou(list, { participantId: "trin", teamId: null }, "team"),
    ).toBeNull();
    expect(
      entrantForYou(
        list,
        { participantId: "trin", teamId: "blue" },
        "individual",
      ),
    ).toBeNull();
  });
});

describe("formatLabel", () => {
  it("names each Format for Organizers", () => {
    expect(formatLabel("points")).toBe("Points");
    expect(formatLabel("single-elimination")).toBe("Single elimination");
  });
});
