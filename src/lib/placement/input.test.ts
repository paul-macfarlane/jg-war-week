import { describe, expect, it } from "vitest";

import {
  PLACE_ERROR,
  SCORE_ERROR,
  parsePlacementIdInput,
  parsePlacementTargetInput,
  parseSavePlacementsInput,
} from "@/lib/placement/input";

const ROW = "11111111-1111-4111-8111-111111111111";

describe("parseSavePlacementsInput", () => {
  it("reads typed text: blank is none, Places and Scores as numbers", () => {
    expect(
      parseSavePlacementsInput({
        rows: [
          { id: ROW, place: "2", score: " 12.125 " },
          { id: ROW, place: "", score: "" },
          { id: ROW, place: 1, score: -3 },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        rows: [
          { id: ROW, place: 2, score: 12.125 },
          { id: ROW, place: null, score: null },
          { id: ROW, place: 1, score: -3 },
        ],
      },
    });
  });

  it.each(["0", "1.5", "x", "-1"])("refuses the Place %j", (place) => {
    expect(
      parseSavePlacementsInput({
        rows: [{ id: ROW, place, score: "" }],
      }),
    ).toEqual({ ok: false, error: PLACE_ERROR });
  });

  it.each(["1.0001", "abc", "1e12"])("refuses the Score %j", (score) => {
    expect(
      parseSavePlacementsInput({
        scoreDirection: "none",
        rows: [{ id: ROW, place: "", score }],
      }),
    ).toEqual({ ok: false, error: SCORE_ERROR });
  });

  it("never carries a Score direction: it saves only as its own setting, under its lock", () => {
    expect(
      parseSavePlacementsInput({ scoreDirection: "lower", rows: [] }),
    ).toEqual({ ok: true, value: { rows: [] } });
  });

  it("refuses a malformed row id", () => {
    expect(
      parseSavePlacementsInput({
        scoreDirection: "none",
        rows: [{ id: "nope", place: "1", score: "" }],
      }),
    ).toEqual({ ok: false, error: "That Placement no longer exists." });
  });
});

describe("parsePlacementTargetInput and parsePlacementIdInput", () => {
  it("take exactly one of a Team or a Participant", () => {
    expect(parsePlacementTargetInput({ teamId: ROW })).toEqual({
      ok: true,
      value: { teamId: ROW },
    });
    expect(parsePlacementTargetInput({ participantId: ROW })).toEqual({
      ok: true,
      value: { participantId: ROW },
    });
    for (const bad of [{ teamId: ROW, participantId: ROW }, {}, null]) {
      expect(parsePlacementTargetInput(bad)).toEqual({
        ok: false,
        error: "Choose someone to add.",
      });
    }
  });

  it("takes a row id to remove", () => {
    expect(parsePlacementIdInput({ placementId: ROW })).toEqual({
      ok: true,
      value: { placementId: ROW },
    });
    expect(parsePlacementIdInput({ placementId: "x" })).toEqual({
      ok: false,
      error: "That Placement no longer exists.",
    });
  });
});
