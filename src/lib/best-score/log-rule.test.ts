import { describe, expect, it } from "vitest";

import {
  ATTEMPT_MISSING,
  type AttemptLogFacet,
  COMPETITION_CLOSED,
  NOT_LINKED,
  NOT_ON_A_TEAM,
  NOT_YOURS,
  SELF_REPORT_OFF,
  attemptChangeError,
  attemptLogError,
  attemptLogOffer,
  attemptsLeft,
  maxAttemptsError,
  noAttemptsLeft,
  updatesInPlace,
} from "@/lib/best-score/log-rule";

/** I'm Ana (Red), linked, self-report on, posting my own first Attempt. */
function facet(over: Partial<AttemptLogFacet> = {}): AttemptLogFacet {
  return {
    runs: false,
    closed: false,
    selfReport: true,
    linked: { participantId: "ana", teamId: "red" },
    scoring: "individual",
    participantId: "ana",
    attempt: null,
    maxAttempts: null,
    attemptsSoFar: 0,
    ...over,
  };
}

const host = (over: Partial<AttemptLogFacet> = {}) =>
  facet({ runs: true, linked: null, participantId: "ben", ...over });

describe("attemptLogError", () => {
  it("with self-report on, lets a linked Participant log as themselves, with no Entrant list", () => {
    expect(attemptLogError(facet())).toBeNull();
  });

  it("with self-report off, refuses the Participant but not a Host or Organizer", () => {
    expect(attemptLogError(facet({ selfReport: false }))).toBe(SELF_REPORT_OFF);
    expect(attemptLogError(host({ selfReport: false }))).toBeNull();
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
  });

  it("binds a Host and Organizer too once Closed (D1a)", () => {
    expect(attemptLogError(host({ closed: true }))).toBe(COMPETITION_CLOSED);
    expect(attemptLogError(facet({ closed: true }))).toBe(COMPETITION_CLOSED);
  });

  it("with Max attempts 3, refuses a fourth Attempt for the Participant and for an Organizer (AC 7)", () => {
    expect(attemptLogError(facet({ maxAttempts: 3, attemptsSoFar: 2 }))).toBe(
      null,
    );
    expect(attemptLogError(facet({ maxAttempts: 3, attemptsSoFar: 3 }))).toBe(
      noAttemptsLeft(3),
    );
    expect(attemptLogError(host({ maxAttempts: 3, attemptsSoFar: 3 }))).toBe(
      noAttemptsLeft(3),
    );
    expect(noAttemptsLeft(3)).toBe(
      "No Attempts left: the limit is 3 per person.",
    );
  });

  it("with Max attempts 1 and an Attempt in, allows the save as an update in place (AC 9)", () => {
    const atLimit = facet({ maxAttempts: 1, attemptsSoFar: 1 });
    expect(attemptLogError(atLimit)).toBeNull();
    expect(updatesInPlace(atLimit)).toBe(true);
    expect(updatesInPlace(host({ maxAttempts: 1, attemptsSoFar: 1 }))).toBe(
      true,
    );
    expect(updatesInPlace(facet({ maxAttempts: 1, attemptsSoFar: 0 }))).toBe(
      false,
    );
    expect(updatesInPlace(facet({ maxAttempts: 3, attemptsSoFar: 3 }))).toBe(
      false,
    );
  });

  it("with no limit, never refuses for the count", () => {
    expect(attemptLogError(facet({ attemptsSoFar: 40 }))).toBeNull();
  });
});

describe("attemptsLeft", () => {
  it("counts down to 0, and is null with no limit", () => {
    expect(attemptsLeft(3, 0)).toBe(3);
    expect(attemptsLeft(3, 2)).toBe(1);
    expect(attemptsLeft(3, 5)).toBe(0);
    expect(attemptsLeft(null, 5)).toBeNull();
  });
});

describe("attemptLogOffer", () => {
  it("offers a Participant Log an Attempt with how many are left", () => {
    expect(
      attemptLogOffer(facet({ maxAttempts: 3, attemptsSoFar: 1 })),
    ).toEqual({
      label: "Log an Attempt",
      attemptsLeft: 2,
      disabledReason: null,
    });
  });

  it("reads Update your score at Max attempts 1 with an Attempt in", () => {
    expect(
      attemptLogOffer(facet({ maxAttempts: 1, attemptsSoFar: 1 })),
    ).toEqual({
      label: "Update your score",
      attemptsLeft: 0,
      disabledReason: null,
    });
  });

  it("disables the button, with the reason, once the limit is used", () => {
    expect(
      attemptLogOffer(facet({ maxAttempts: 3, attemptsSoFar: 3 })),
    ).toEqual({
      label: "Log an Attempt",
      attemptsLeft: 0,
      disabledReason: noAttemptsLeft(3),
    });
  });

  it("offers nothing when self-report is off, unlinked, on no Team, or Closed", () => {
    expect(attemptLogOffer(facet({ selfReport: false }))).toBeNull();
    expect(attemptLogOffer(facet({ linked: null }))).toBeNull();
    expect(
      attemptLogOffer(
        facet({
          scoring: "team",
          linked: { participantId: "ana", teamId: null },
        }),
      ),
    ).toBeNull();
    expect(attemptLogOffer(facet({ closed: true }))).toBeNull();
  });

  it("offers a Host or Organizer the button whatever anyone's count", () => {
    expect(attemptLogOffer(host({ selfReport: false }))).toEqual({
      label: "Log an Attempt",
      attemptsLeft: null,
      disabledReason: null,
    });
    expect(attemptLogOffer(host({ closed: true }))).toBeNull();
  });
});

describe("attemptChangeError", () => {
  const mine = { participantId: "ana" };

  it("lets the Participant change their own Attempt, whoever logged it (AC 10)", () => {
    expect(attemptChangeError(facet({ attempt: mine }))).toBeNull();
    expect(
      attemptChangeError(facet({ attempt: mine, participantId: null })),
    ).toBeNull();
  });

  it("refuses another Participant's Attempt, a missing one, and moving it to another person", () => {
    expect(
      attemptChangeError(facet({ attempt: { participantId: "ben" } })),
    ).toBe(NOT_YOURS);
    expect(attemptChangeError(facet({ attempt: "missing" }))).toBe(
      ATTEMPT_MISSING,
    );
    expect(
      attemptChangeError(facet({ attempt: mine, participantId: "ben" })),
    ).toBe(NOT_YOURS);
  });

  it("refuses the Participant with self-report off, not a Host", () => {
    expect(
      attemptChangeError(facet({ attempt: mine, selfReport: false })),
    ).toBe(SELF_REPORT_OFF);
    expect(
      attemptChangeError(host({ attempt: mine, selfReport: false })),
    ).toBeNull();
  });

  it("refuses everyone once Closed: Reopen first (D1a)", () => {
    expect(attemptChangeError(facet({ attempt: mine, closed: true }))).toBe(
      COMPETITION_CLOSED,
    );
    expect(attemptChangeError(host({ attempt: mine, closed: true }))).toBe(
      COMPETITION_CLOSED,
    );
  });

  it("never counts an edit against Max attempts", () => {
    expect(
      attemptChangeError(
        facet({ attempt: mine, maxAttempts: 2, attemptsSoFar: 2 }),
      ),
    ).toBeNull();
  });
});

describe("maxAttemptsError", () => {
  it("refuses a limit below the most Attempts any one person has, else allows it", () => {
    expect(maxAttemptsError(2, 3)).toBe(
      "Someone already has 3 Attempts, so the limit can't be below 3.",
    );
    expect(maxAttemptsError(3, 3)).toBeNull();
    expect(maxAttemptsError(null, 9)).toBeNull();
    expect(maxAttemptsError(1, 0)).toBeNull();
  });
});
