import { describe, expect, it } from "vitest";

import {
  type RosterParticipantInput,
  buildRoster,
  participantCountLabel,
  rosterHeading,
} from "@/lib/roster";

const red = { id: "t-red", name: "Red", color: "#ff3b3b", logoUrl: null };
const blue = {
  id: "t-blue",
  name: "Blue",
  color: "#3b82f6",
  logoUrl: "/blue.svg",
};

function person(
  displayName: string,
  teamId: string | null,
  extra: Partial<RosterParticipantInput> = {},
): RosterParticipantInput {
  return {
    id: `p-${displayName}`,
    displayName,
    companyTag: null,
    teamId,
    isLeader: false,
    ...extra,
  };
}

describe("buildRoster", () => {
  it("lists Teams by name, each with Leaders first and then by name", () => {
    const roster = buildRoster({
      mode: "teams",
      teams: [red, blue],
      participants: [
        person("Zed", "t-red"),
        person("Morpheus", "t-red", { isLeader: true }),
        person("Apoc", "t-red"),
        person("Niobe", "t-blue", { isLeader: true, companyTag: "LTI" }),
        person("Ghost", "t-blue"),
      ],
    });

    expect(roster).toEqual({
      kind: "teams",
      teams: [
        {
          ...blue,
          participants: [
            {
              id: "p-Niobe",
              displayName: "Niobe",
              companyTag: "LTI",
              isLeader: true,
            },
            {
              id: "p-Ghost",
              displayName: "Ghost",
              companyTag: null,
              isLeader: false,
            },
          ],
        },
        {
          ...red,
          participants: [
            {
              id: "p-Morpheus",
              displayName: "Morpheus",
              companyTag: null,
              isLeader: true,
            },
            {
              id: "p-Apoc",
              displayName: "Apoc",
              companyTag: null,
              isLeader: false,
            },
            {
              id: "p-Zed",
              displayName: "Zed",
              companyTag: null,
              isLeader: false,
            },
          ],
        },
      ],
      unassigned: [],
    });
  });

  it("keeps a Team with no Participants and collects Participants with no Team", () => {
    const roster = buildRoster({
      mode: "teams",
      teams: [red],
      participants: [person("Tank", null)],
    });

    expect(roster).toEqual({
      kind: "teams",
      teams: [{ ...red, participants: [] }],
      unassigned: [
        {
          id: "p-Tank",
          displayName: "Tank",
          companyTag: null,
          isLeader: false,
        },
      ],
    });
  });

  it("shows one roster of all Participants in a free-for-all War Week", () => {
    const roster = buildRoster({
      mode: "free-for-all",
      teams: [],
      participants: [
        person("Trinity", null, { companyTag: "IL" }),
        person("Cypher", null),
      ],
    });

    expect(roster).toEqual({
      kind: "free-for-all",
      participants: [
        {
          id: "p-Cypher",
          displayName: "Cypher",
          companyTag: null,
          isLeader: false,
        },
        {
          id: "p-Trinity",
          displayName: "Trinity",
          companyTag: "IL",
          isLeader: false,
        },
      ],
    });
  });

  it("returns an empty free-for-all roster when there are no Participants", () => {
    expect(
      buildRoster({ mode: "free-for-all", teams: [], participants: [] }),
    ).toEqual({ kind: "free-for-all", participants: [] });
  });
});

describe("rosterHeading", () => {
  it.each([
    ["teams", "House", "Houses"],
    ["teams", "Tribe", "Tribes"],
    ["free-for-all", "Team", "Participants"],
  ] as const)("%s mode with label %s is %s", (mode, label, expected) => {
    expect(rosterHeading(mode, label)).toBe(expected);
  });
});

describe("participantCountLabel", () => {
  it.each([
    [0, "0 Participants"],
    [1, "1 Participant"],
    [8, "8 Participants"],
  ])("labels %d as %s", (count, expected) => {
    expect(participantCountLabel(count)).toBe(expected);
  });
});
