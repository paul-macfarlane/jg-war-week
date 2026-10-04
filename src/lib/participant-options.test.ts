import { describe, expect, it } from "vitest";

import {
  buildParticipantOptions,
  filterParticipantOptions,
  nameMatches,
  optionDetail,
} from "./participant-options";

/** A roster of `n` Participants, each with a distinct name and a roster email. */
function roster(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Person ${String(i).padStart(3, "0")} Ocelot`,
    image: null,
    teamName: i % 2 === 0 ? "Red Alpha" : "Blue Beta",
    teamColor: i % 2 === 0 ? "#ff0000" : "#0000ff",
    // Present at runtime on a careless caller's row, never in the options.
    email: `person${i}@jahnelgroup.com`,
  }));
}

describe("buildParticipantOptions", () => {
  it("keeps id, name, picture, Team name and color, and drops anything else", () => {
    const [option] = buildParticipantOptions(roster(1));
    expect(option).toEqual({
      id: "p0",
      name: "Person 000 Ocelot",
      image: null,
      teamName: "Red Alpha",
      teamColor: "#ff0000",
    });
    expect(JSON.stringify(option)).not.toContain("@");
  });

  it("carries a note such as Can't sign in beside the Team", () => {
    const [option] = buildParticipantOptions([
      { id: "p1", name: "Cy Q", note: "Can't sign in" },
    ]);
    expect(option.teamName).toBeNull();
    expect(optionDetail(option)).toBe("Can't sign in");
  });
});

describe("name-only search", () => {
  const options = buildParticipantOptions(roster(120));

  it("finds a Participant by part of their display name, ignoring case", () => {
    expect(
      filterParticipantOptions(options, "PERSON 117").map((o) => o.id),
    ).toEqual(["p117"]);
  });

  it("returns every match with no cap at 100+ options", () => {
    expect(filterParticipantOptions(options, "ocelot")).toHaveLength(120);
    expect(filterParticipantOptions(options, "")).toHaveLength(120);
  });

  it("finds a Participant beyond the 100th", () => {
    expect(filterParticipantOptions(options, "Person 119")).toHaveLength(1);
  });

  it("finds nothing by an email or a part of one", () => {
    expect(
      filterParticipantOptions(options, "person5@jahnelgroup.com"),
    ).toEqual([]);
    expect(filterParticipantOptions(options, "@jahnelgroup")).toEqual([]);
    expect(filterParticipantOptions(options, "jahnelgroup.com")).toEqual([]);
  });

  it("does not match on the Team's name", () => {
    expect(filterParticipantOptions(options, "Red Alpha")).toEqual([]);
    expect(nameMatches("Ana P", "alpha")).toBe(false);
  });
});
