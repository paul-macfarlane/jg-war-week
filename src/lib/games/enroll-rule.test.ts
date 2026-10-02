import { describe, expect, it } from "vitest";

import {
  ALREADY_ENTERED,
  ALREADY_IN_A_SQUAD,
  ENROLL_CLOSED_BUILT,
  ENROLL_CLOSED_BY_HOST,
  ENROLL_CLOSED_FULL,
  ENROLL_CLOSED_GAME_LOGGED,
  ENROLL_CLOSED_TIME,
  ENROLL_OFF,
  type EnrollFacet,
  JOIN_A_SQUAD,
  LAST_IN_SQUAD,
  NOT_ENTERED,
  NOT_IN_SQUAD,
  NOT_LINKED,
  NOT_ON_A_TEAM,
  NOT_YOUR_TEAMS_SQUAD,
  SQUAD_FULL,
  SQUAD_MISSING,
  TEAM_ALREADY_ENTERED,
  TEAM_NOT_ENTERED,
  enrollError,
  enrollmentUnavailable,
  withdrawError,
} from "@/lib/games/enroll-rule";

const ME = "participant-me";
const RIVAL = "participant-rival";
const RED = "team-red";
const BLUE = "team-blue";
const RED_ALPHA = "squad-red-alpha";
const RED_BRAVO = "squad-red-bravo";

const NOW = new Date("2027-02-22T15:00:00Z");
const LATER = new Date("2027-02-22T18:00:00Z");
const EARLIER = new Date("2027-02-22T12:00:00Z");

const participant = (participantId: string) => ({
  teamId: null,
  participantId,
});
const team = (teamId: string) => ({ teamId, participantId: null });

/** An individual Competition with the switch on; I'm linked, not entered. */
function facet(over: Partial<EnrollFacet> = {}): EnrollFacet {
  return {
    selfEnroll: true,
    closed: false,
    built: false,
    hasGames: false,
    entrantLimit: null,
    entrantCount: 1,
    enrollClosesAt: null,
    now: NOW,
    scoring: "individual",
    linked: { participantId: ME, teamId: RED, squadId: null },
    entrants: [participant(RIVAL)],
    hasSquads: false,
    squad: null,
    ...over,
  };
}

/** Entered: the individual facet with me on the Entrant list. */
const entered = (over: Partial<EnrollFacet> = {}) =>
  facet({
    entrants: [participant(RIVAL), participant(ME)],
    entrantCount: 2,
    ...over,
  });

/** A team Competition: Blue entered, Red (mine) not. */
const teamFacet = (over: Partial<EnrollFacet> = {}) =>
  facet({ scoring: "team", entrants: [team(BLUE)], ...over });

/** A Squads Bracket: Red Alpha has 3 Participants, I'm in none. */
const squadFacet = (over: Partial<EnrollFacet> = {}) =>
  facet({
    scoring: "team",
    entrants: [],
    hasSquads: true,
    squad: { id: RED_ALPHA, teamId: RED, participantCount: 3 },
    ...over,
  });

/** Each enrollment close condition, in the order they're checked. */
const closeConditions: [string, Partial<EnrollFacet>, string][] = [
  ["the Bracket is built", { built: true }, ENROLL_CLOSED_BUILT],
  [
    "the Entrant limit is reached",
    { entrantLimit: 2, entrantCount: 2 },
    ENROLL_CLOSED_FULL,
  ],
  [
    "the close time has passed",
    { enrollClosesAt: EARLIER },
    ENROLL_CLOSED_TIME,
  ],
  [
    "the close time is exactly now",
    { enrollClosesAt: NOW },
    ENROLL_CLOSED_TIME,
  ],
  ["the Host closed the Competition", { closed: true }, ENROLL_CLOSED_BY_HOST],
  ["the first Game is logged", { hasGames: true }, ENROLL_CLOSED_GAME_LOGGED],
];

describe("enrollError: a Participant enrolls", () => {
  it("lets a linked Participant enroll while the switch is on", () => {
    expect(enrollError(facet())).toBeNull();
  });

  it("refuses when the Host's switch is off", () => {
    expect(enrollError(facet({ selfEnroll: false }))).toBe(ENROLL_OFF);
  });

  it("refuses an unlinked You: account linking is required", () => {
    expect(enrollError(facet({ linked: null }))).toBe(NOT_LINKED);
  });

  it.each(closeConditions)("refuses once %s", (_, over, expected) => {
    expect(enrollError(facet(over))).toBe(expected);
  });

  it("checks the close conditions in order", () => {
    expect(
      enrollError(
        facet({
          built: true,
          entrantLimit: 1,
          enrollClosesAt: EARLIER,
          closed: true,
          hasGames: true,
        }),
      ),
    ).toBe(ENROLL_CLOSED_BUILT);
    expect(enrollError(facet({ enrollClosesAt: EARLIER, closed: true }))).toBe(
      ENROLL_CLOSED_TIME,
    );
  });

  it("stays open under the limit and before the close time", () => {
    expect(
      enrollError(facet({ entrantLimit: 2, enrollClosesAt: LATER })),
    ).toBeNull();
  });

  it("refuses a Participant already entered", () => {
    expect(enrollError(entered())).toBe(ALREADY_ENTERED);
  });

  it("the Host is bound too: enrollment has no Host shortcut", () => {
    // A Host adds Entrants through the picker; the facet has no `runs`.
    expect(enrollError(facet({ selfEnroll: false }))).toBe(ENROLL_OFF);
  });
});

describe("enrollError: team scoring", () => {
  it("lets any Participant on a Team enter their Team", () => {
    expect(enrollError(teamFacet())).toBeNull();
  });

  it("refuses when their Team is already entered", () => {
    expect(enrollError(teamFacet({ entrants: [team(RED)] }))).toBe(
      TEAM_ALREADY_ENTERED,
    );
  });

  it("refuses a Participant on no Team", () => {
    expect(
      enrollError(
        teamFacet({
          linked: { participantId: ME, teamId: null, squadId: null },
        }),
      ),
    ).toBe(NOT_ON_A_TEAM);
  });

  it("refuses Team enrollment once the Competition has a Squad", () => {
    expect(enrollError(teamFacet({ hasSquads: true }))).toBe(JOIN_A_SQUAD);
  });
});

describe("enrollError: joining a Squad", () => {
  it("lets a Participant join a Squad of their own Team", () => {
    expect(enrollError(squadFacet())).toBeNull();
  });

  it("refuses a Squad that no longer exists", () => {
    expect(enrollError(squadFacet({ squad: "missing" }))).toBe(SQUAD_MISSING);
  });

  it("refuses another Team's Squad", () => {
    expect(
      enrollError(
        squadFacet({
          squad: { id: "squad-blue-alpha", teamId: BLUE, participantCount: 3 },
        }),
      ),
    ).toBe(NOT_YOUR_TEAMS_SQUAD);
  });

  it("refuses a full Squad (16 Participants)", () => {
    expect(
      enrollError(
        squadFacet({
          squad: { id: RED_ALPHA, teamId: RED, participantCount: 16 },
        }),
      ),
    ).toBe(SQUAD_FULL);
    expect(
      enrollError(
        squadFacet({
          squad: { id: RED_ALPHA, teamId: RED, participantCount: 15 },
        }),
      ),
    ).toBeNull();
  });

  it("refuses a Participant already in a Squad of this Competition", () => {
    expect(
      enrollError(
        squadFacet({
          linked: { participantId: ME, teamId: RED, squadId: RED_BRAVO },
        }),
      ),
    ).toBe(ALREADY_IN_A_SQUAD);
  });

  it("refuses once the Host closed the Competition", () => {
    expect(enrollError(squadFacet({ closed: true }))).toBe(
      ENROLL_CLOSED_BY_HOST,
    );
  });

  it("refuses with the switch off or without account linking", () => {
    expect(enrollError(squadFacet({ selfEnroll: false }))).toBe(ENROLL_OFF);
    expect(enrollError(squadFacet({ linked: null }))).toBe(NOT_LINKED);
  });
});

describe("withdrawError: a Participant withdraws", () => {
  it("lets an entered Participant withdraw before enrollment closes", () => {
    expect(withdrawError(entered())).toBeNull();
  });

  it.each(
    closeConditions.filter(([, over]) => over.entrantLimit === undefined),
  )("refuses once %s: only the Host removes them now", (_, over, expected) => {
    expect(withdrawError(entered(over))).toBe(expected);
  });

  it("lets them withdraw at the Entrant limit: withdrawing frees a place", () => {
    expect(
      withdrawError(entered({ entrantLimit: 2, entrantCount: 2 })),
    ).toBeNull();
  });

  it("refuses a Participant who isn't entered", () => {
    expect(withdrawError(facet())).toBe(NOT_ENTERED);
  });

  it("refuses with the switch off or without account linking", () => {
    expect(withdrawError(entered({ selfEnroll: false }))).toBe(ENROLL_OFF);
    expect(withdrawError(entered({ linked: null }))).toBe(NOT_LINKED);
  });

  it("lets any Participant on an entered Team withdraw it", () => {
    expect(withdrawError(teamFacet({ entrants: [team(RED)] }))).toBeNull();
    expect(withdrawError(teamFacet())).toBe(TEAM_NOT_ENTERED);
  });
});

describe("withdrawError: leaving a Squad", () => {
  const inAlpha = { participantId: ME, teamId: RED, squadId: RED_ALPHA };

  it("lets a Participant in the Squad leave it", () => {
    expect(withdrawError(squadFacet({ linked: inAlpha }))).toBeNull();
  });

  it("refuses a Participant not in that Squad", () => {
    expect(withdrawError(squadFacet())).toBe(NOT_IN_SQUAD);
    expect(
      withdrawError(
        squadFacet({
          linked: { participantId: ME, teamId: RED, squadId: RED_BRAVO },
        }),
      ),
    ).toBe(NOT_IN_SQUAD);
  });

  it("refuses the last Participant: ask the Host to remove the Squad", () => {
    expect(
      withdrawError(
        squadFacet({
          linked: inAlpha,
          squad: { id: RED_ALPHA, teamId: RED, participantCount: 1 },
        }),
      ),
    ).toBe(LAST_IN_SQUAD);
  });

  it("refuses a Squad that no longer exists", () => {
    expect(withdrawError(squadFacet({ squad: "missing" }))).toBe(SQUAD_MISSING);
  });

  it("refuses once the Host closed the Competition", () => {
    expect(withdrawError(squadFacet({ linked: inAlpha, closed: true }))).toBe(
      ENROLL_CLOSED_BY_HOST,
    );
  });
});

describe("enrollmentUnavailable: where enrollment is offered", () => {
  const h2h = { drawsAllowed: false, bestOf: null };

  it.each([
    [
      "a points Competition has no Entrant list",
      {
        format: "points" as const,
        entrantsOpen: false,
        gameType: null,
        gameConfig: null,
      },
      "Participants enroll only in a Bracket or a Games Competition.",
    ],
    [
      "a Bracket offers it",
      {
        format: "single-elimination" as const,
        entrantsOpen: false,
        gameType: null,
        gameConfig: null,
      },
      null,
    ],
    [
      "a Games Competition open to everyone has no list",
      {
        format: "games" as const,
        entrantsOpen: true,
        gameType: "head-to-head" as const,
        gameConfig: h2h,
      },
      "Everyone can play already; there's no list to enroll in.",
    ],
    [
      "a Best of is set by the Host",
      {
        format: "games" as const,
        entrantsOpen: false,
        gameType: "head-to-head" as const,
        gameConfig: { drawsAllowed: false, bestOf: 5 as const },
      },
      "A Best of is set by the Host; enrollment is off.",
    ],
    [
      "a fixed-list Games Competition offers it",
      {
        format: "games" as const,
        entrantsOpen: false,
        gameType: "ranked" as const,
        gameConfig: { finishPoints: [] },
      },
      null,
    ],
  ])("%s", (_, competition, expected) => {
    expect(enrollmentUnavailable(competition)).toBe(expected);
  });
});
