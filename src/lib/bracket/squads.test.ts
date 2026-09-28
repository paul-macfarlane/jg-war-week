import { describe, expect, it } from "vitest";

import {
  SQUAD_NAME_MAX,
  SQUAD_PARTICIPANTS_MAX,
  entrantKindError,
  squadError,
  squadLabel,
} from "@/lib/bracket/squads";

const RED = "team-red";
const BLUE = "team-blue";
const ashley = { id: "p-ashley", displayName: "Ashley Schuliger", teamId: RED };
const sam = { id: "p-sam", displayName: "Sam Schantz", teamId: RED };
const graham = { id: "p-graham", displayName: "Graham Macbeth", teamId: BLUE };

const valid = {
  name: "Red Alpha",
  teamId: RED,
  participants: [ashley, sam],
  taken: {},
};

describe("squadError", () => {
  it("accepts a named Squad of one Team's Participants", () => {
    expect(squadError(valid)).toBeNull();
  });

  it("accepts a Squad of one Participant", () => {
    expect(squadError({ ...valid, participants: [ashley] })).toBeNull();
  });

  it("refuses a blank name", () => {
    expect(squadError({ ...valid, name: "   " })).toEqual({
      error: "Enter the Squad's name.",
      fieldErrors: { name: "Enter the Squad's name." },
    });
  });

  it("refuses a name over 80 characters", () => {
    expect(SQUAD_NAME_MAX).toBe(80);
    expect(squadError({ ...valid, name: "x".repeat(81) })).toEqual({
      error: "Keep the name to 80 characters or fewer.",
      fieldErrors: { name: "Keep the name to 80 characters or fewer." },
    });
    expect(squadError({ ...valid, name: "x".repeat(80) })).toBeNull();
  });

  it("refuses a Squad with no Team, in the War Week's Team Label", () => {
    expect(squadError({ ...valid, teamId: null, teamLabel: "House" })).toEqual({
      error: "Choose a House.",
      fieldErrors: { teamId: "Choose a House." },
    });
  });

  it("refuses a Squad with no Participants", () => {
    expect(squadError({ ...valid, participants: [] })).toEqual({
      error: "Add at least one Participant.",
      fieldErrors: { participantIds: "Add at least one Participant." },
    });
  });

  it("refuses more than 16 Participants", () => {
    expect(SQUAD_PARTICIPANTS_MAX).toBe(16);
    const many = Array.from({ length: 17 }, (_, i) => ({
      id: `p${i}`,
      displayName: `P${i}`,
      teamId: RED,
    }));
    expect(squadError({ ...valid, participants: many })).toEqual({
      error: "A Squad has at most 16 Participants.",
      fieldErrors: { participantIds: "A Squad has at most 16 Participants." },
    });
    expect(
      squadError({ ...valid, participants: many.slice(0, 16) }),
    ).toBeNull();
  });

  it("refuses a Squad spanning Teams", () => {
    const error = "Every Participant in a Squad must be on the same House.";
    expect(
      squadError({
        ...valid,
        teamLabel: "House",
        participants: [ashley, graham],
      }),
    ).toEqual({ error, fieldErrors: { participantIds: error } });
  });

  it("refuses a Participant with no Team", () => {
    expect(
      squadError({
        ...valid,
        participants: [ashley, { ...sam, teamId: null }],
      }),
    ).toMatchObject({
      error: "Every Participant in a Squad must be on the same Team.",
    });
  });

  it("refuses a Participant already in another Squad of the Competition", () => {
    expect(squadError({ ...valid, taken: { [sam.id]: "Red Bravo" } })).toEqual({
      error: "Sam Schantz is already in Red Bravo.",
      fieldErrors: { participantIds: "Sam Schantz is already in Red Bravo." },
    });
  });

  it("checks the name, then the Team, then the Participants", () => {
    expect(
      squadError({ name: "", teamId: null, participants: [], taken: {} }),
    ).toMatchObject({ error: "Enter the Squad's name." });
    expect(
      squadError({ name: "A", teamId: null, participants: [], taken: {} }),
    ).toMatchObject({ error: "Choose a Team." });
  });
});

describe("entrantKindError", () => {
  it.each<
    ["team" | "individual", "team" | "participant" | "squad", string | null]
  >([
    ["team", "team", null],
    ["team", "squad", null],
    [
      "team",
      "participant",
      "A team Competition's Entrants are Teams or Squads.",
    ],
    ["individual", "participant", null],
    [
      "individual",
      "team",
      "An individual Competition's Entrants are Participants.",
    ],
    [
      "individual",
      "squad",
      "An individual Competition's Entrants are Participants.",
    ],
  ])("%s scoring with %s Entrants", (scoring, kind, expected) => {
    expect(entrantKindError(scoring, kind)).toBe(expected);
  });
});

describe("squadLabel", () => {
  it("reads name · Team · Participants", () => {
    expect(
      squadLabel({
        name: "Red Alpha",
        teamName: "Red",
        participants: [ashley, sam],
      }),
    ).toBe("Red Alpha · Red · Ashley Schuliger, Sam Schantz");
  });
});
