import { describe, expect, it } from "vitest";

import {
  parseMarkInput,
  parseParticipationSettingsInput,
} from "@/lib/participation/input";

const valid = {
  participationPoints: "2",
  teamScoring: "ranked",
  placementPoints: "5, 3, 1",
  selfCheckIn: true,
  checkInClosesAt: "2027-02-26T22:00:00.000Z",
};

describe("parseParticipationSettingsInput", () => {
  it("reads N, the team scoring, Placement Points, the switch and the close time", () => {
    expect(parseParticipationSettingsInput(valid)).toEqual({
      ok: true,
      value: {
        participationPoints: 2,
        participationTeamScoring: "ranked",
        placementPoints: [5, 3, 1],
        selfCheckIn: true,
        checkInClosesAt: new Date("2027-02-26T22:00:00.000Z"),
      },
    });
  });

  it("reads blanks as none", () => {
    expect(
      parseParticipationSettingsInput({
        ...valid,
        teamScoring: "",
        placementPoints: "",
        selfCheckIn: false,
        checkInClosesAt: "",
      }),
    ).toEqual({
      ok: true,
      value: {
        participationPoints: 2,
        participationTeamScoring: null,
        placementPoints: null,
        selfCheckIn: false,
        checkInClosesAt: null,
      },
    });
  });

  it.each([
    ["0", "Points per Participant must be more than 0."],
    ["-1", "Points per Participant must be more than 0."],
    ["abc", "Points per Participant must be a number."],
    ["1.234", "Points per Participant must have at most two decimal places."],
    ["1000000", "Points per Participant must be at most 999999.99."],
  ])("refuses %j points per Participant", (participationPoints, error) => {
    expect(
      parseParticipationSettingsInput({ ...valid, participationPoints }),
    ).toEqual({
      ok: false,
      error,
      fieldErrors: { participationPoints: error },
    });
  });

  it("refuses an unknown team scoring, rising Placement Points and a bad close time", () => {
    expect(
      parseParticipationSettingsInput({ ...valid, teamScoring: "most" }),
    ).toMatchObject({ ok: false, error: "Choose how Teams score." });
    expect(
      parseParticipationSettingsInput({ ...valid, placementPoints: "1, 3" }),
    ).toMatchObject({
      ok: false,
      error:
        "Each place's Placement Points must be no more than the place above it.",
    });
    expect(
      parseParticipationSettingsInput({ ...valid, checkInClosesAt: "soon" }),
    ).toMatchObject({ ok: false, error: "Enter a valid check-in close time." });
  });

  it("refuses a malformed request", () => {
    expect(parseParticipationSettingsInput(null)).toMatchObject({ ok: false });
    expect(
      parseParticipationSettingsInput({ ...valid, selfCheckIn: "yes" }),
    ).toMatchObject({ ok: false });
  });
});

describe("parseMarkInput", () => {
  it("reads a Participant id", () => {
    const id = "6f1c2f1e-8a49-4c38-9a4a-0d6f1f3c2b10";
    expect(parseMarkInput({ participantId: id })).toEqual({
      ok: true,
      value: { participantId: id },
    });
  });

  it("refuses anything else", () => {
    expect(parseMarkInput({ participantId: "x" })).toEqual({
      ok: false,
      error: "That Participant no longer exists.",
    });
    expect(parseMarkInput("x")).toMatchObject({ ok: false });
  });
});
