import { describe, expect, it } from "vitest";

import {
  generatedNote,
  generatedRefusal,
  pointsEntryTarget,
  pointsEntryTargetError,
} from "@/lib/points-entry";

describe("pointsEntryTargetError", () => {
  const tug = { name: "Tug of War", scoring: "team" } as const;
  const chess = { name: "Speed Chess", scoring: "individual" } as const;

  it("accepts a Team for a team Competition and a Participant for an individual one", () => {
    expect(pointsEntryTargetError(tug, "team")).toBeNull();
    expect(pointsEntryTargetError(chess, "participant")).toBeNull();
  });

  it("refuses the other kind", () => {
    expect(pointsEntryTargetError(tug, "participant")).toBe(
      '"Tug of War" is a team Competition, so its Points Entries must target a team',
    );
    expect(pointsEntryTargetError(chess, "team")).toBe(
      '"Speed Chess" is an individual Competition, so its Points Entries must target a participant',
    );
  });
});

describe("pointsEntryTarget", () => {
  it("fills exactly one target column", () => {
    expect(pointsEntryTarget("team", "t1")).toEqual({
      teamId: "t1",
      participantId: null,
    });
    expect(pointsEntryTarget("participant", "p1")).toEqual({
      teamId: null,
      participantId: "p1",
    });
  });
});

describe("generated Points Entries", () => {
  it("keep the Bracket wording for a Bracket", () => {
    expect(generatedNote("bracket")).toBe("From bracket");
    expect(generatedRefusal("bracket")).toBe(
      "This Points Entry comes from a bracket. Change it there.",
    );
  });

  it("name the Format for a Head-to-head or Best score Competition", () => {
    expect(generatedNote("head-to-head")).toBe("From head-to-head");
    expect(generatedNote("best-score")).toBe("From best score");
    expect(generatedRefusal("best-score")).toBe(
      "This Points Entry comes from a Best score Competition. Change it there.",
    );
    expect(generatedRefusal("head-to-head")).toBe(
      "This Points Entry comes from a Head-to-head Competition. Change it there.",
    );
  });
  it("say participation for a participation Competition", () => {
    expect(generatedNote("participation")).toBe("From participation");
    expect(generatedRefusal("participation")).toBe(
      "This Points Entry comes from a Participation Competition. Change it there.",
    );
  });
});
