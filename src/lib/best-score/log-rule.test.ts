import { describe, expect, it } from "vitest";

import {
  ATTEMPT_MISSING,
  type AttemptLogFacet,
  COMPETITION_CLOSED,
  NOT_LINKED,
  NOT_ON_A_TEAM,
  NOT_THE_LOGGER,
  NOT_YOURS,
  attemptChangeError,
  attemptLogError,
  canLogAttempt,
} from "@/lib/best-score/log-rule";

/** I'm Ana (Red), linked, posting my own Attempt. */
function facet(over: Partial<AttemptLogFacet> = {}): AttemptLogFacet {
  return {
    runs: false,
    closed: false,
    linked: { participantId: "ana", teamId: "red" },
    scoring: "individual",
    participantId: "ana",
    attempt: null,
    ...over,
  };
}

describe("attemptLogError", () => {
  it("lets any linked Participant log their own Attempt, no Entrant list needed", () => {
    expect(attemptLogError(facet())).toBeNull();
    expect(canLogAttempt(facet({ participantId: null }))).toBe(true);
  });

  it("refuses an Attempt for someone else, and no link", () => {
    expect(attemptLogError(facet({ participantId: "ben" }))).toBe(NOT_YOURS);
    expect(attemptLogError(facet({ linked: null }))).toBe(NOT_LINKED);
  });

  it("in team scoring refuses a Participant on no Team", () => {
    const noTeam = { participantId: "ana", teamId: null };
    expect(attemptLogError(facet({ scoring: "team", linked: noTeam }))).toBe(
      NOT_ON_A_TEAM,
    );
    expect(canLogAttempt(facet({ scoring: "team", linked: noTeam }))).toBe(
      false,
    );
  });

  it("lets a Host log for anyone, until Closed", () => {
    expect(
      attemptLogError(
        facet({ runs: true, linked: null, participantId: "ben" }),
      ),
    ).toBeNull();
    expect(attemptLogError(facet({ runs: true, closed: true }))).toBe(
      COMPETITION_CLOSED,
    );
  });
});

describe("attemptChangeError", () => {
  const mine = { loggedByParticipantId: "ana", participantId: "ana" };

  it("lets the logger change their own Attempt", () => {
    expect(attemptChangeError(facet({ attempt: mine }))).toBeNull();
    expect(
      attemptChangeError(facet({ attempt: mine, participantId: null })),
    ).toBeNull();
  });

  it("refuses someone else's, a missing one, and moving it to another person", () => {
    expect(
      attemptChangeError(
        facet({
          attempt: { loggedByParticipantId: null, participantId: "ana" },
        }),
      ),
    ).toBe(NOT_THE_LOGGER);
    expect(attemptChangeError(facet({ attempt: "missing" }))).toBe(
      ATTEMPT_MISSING,
    );
    expect(
      attemptChangeError(facet({ attempt: mine, participantId: "ben" })),
    ).toBe(NOT_YOURS);
  });
});
