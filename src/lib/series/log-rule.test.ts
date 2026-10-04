import { describe, expect, it } from "vitest";

import {
  COMPETITION_CLOSED,
  MATCH_MISSING,
  NEEDS_TWO_ENTRANTS,
  NOT_AN_ENTRANT,
  NOT_A_PLAYER,
  NOT_LINKED,
  REPEATED_PLAYER,
  SELF_REPORT_OFF,
  SERIES_DECIDED,
  SERIES_DRAWN,
  type SeriesLogFacet,
  TWO_PLAYERS,
  playersRuleError,
  seriesChangeError,
  seriesLogError,
  seriesLogOffer,
} from "@/lib/series/log-rule";

const ana = { teamId: null, participantId: "ana" };
const ben = { teamId: null, participantId: "ben" };
const cal = { teamId: null, participantId: "cal" };

/**
 * Ana and Ben's Best of 3, self-report on, one Match played; I'm Ana,
 * linked, and post a Match between the two.
 */
function facet(over: Partial<SeriesLogFacet> = {}): SeriesLogFacet {
  return {
    runs: false,
    closed: false,
    selfReport: true,
    decided: false,
    played: 1,
    bestOf: 3,
    linked: { participantId: "ana", teamId: "red" },
    scoring: "individual",
    entrants: [ana, ben],
    players: [ana, ben],
    match: null,
    ...over,
  };
}

const host = (over: Partial<SeriesLogFacet> = {}) =>
  facet({ runs: true, linked: null, ...over });

describe("seriesLogError", () => {
  it("with self-report on, lets either Entrant log a Match between the two", () => {
    expect(seriesLogError(facet())).toBeNull();
    expect(
      seriesLogError(facet({ linked: { participantId: "ben", teamId: null } })),
    ).toBeNull();
  });

  it("with self-report off, refuses the Entrants but not a Host", () => {
    expect(seriesLogError(facet({ selfReport: false }))).toBe(SELF_REPORT_OFF);
    expect(seriesLogError(host({ selfReport: false }))).toBeNull();
  });

  it("refuses no link, a non-player and a non-Entrant", () => {
    expect(seriesLogError(facet({ linked: null }))).toBe(NOT_LINKED);
    expect(
      seriesLogError(facet({ linked: { participantId: "cal", teamId: null } })),
    ).toBe(NOT_A_PLAYER);
    expect(seriesLogError(facet({ players: [ana, cal] }))).toBe(NOT_AN_ENTRANT);
  });

  it("once a side has the majority (2–0 in a Best of 3), refuses a third Match for everyone (AC 6)", () => {
    expect(seriesLogError(facet({ decided: true, played: 2 }))).toBe(
      SERIES_DECIDED,
    );
    expect(seriesLogError(host({ decided: true, played: 2 }))).toBe(
      SERIES_DECIDED,
    );
  });

  it("once every Match is played with no majority, the series is drawn and takes no more", () => {
    expect(seriesLogError(facet({ played: 3 }))).toBe(SERIES_DRAWN);
    expect(seriesLogError(host({ played: 3 }))).toBe(SERIES_DRAWN);
  });

  it("binds everyone once Closed", () => {
    expect(seriesLogError(host({ closed: true }))).toBe(COMPETITION_CLOSED);
  });

  it("in team scoring, anyone on an Entrant Team may log", () => {
    const red = { teamId: "red", participantId: null };
    const blue = { teamId: "blue", participantId: null };
    expect(
      seriesLogError(
        facet({ scoring: "team", entrants: [red, blue], players: [red, blue] }),
      ),
    ).toBeNull();
    expect(
      seriesLogError(
        facet({
          scoring: "team",
          entrants: [red, blue],
          players: [red, blue],
          linked: { participantId: "ana", teamId: null },
        }),
      ),
    ).toBe(NOT_A_PLAYER);
  });
});

describe("seriesLogOffer", () => {
  it("offers the Entrants and a Host the button while the series is open", () => {
    expect(seriesLogOffer(facet())).toEqual({ disabledReason: null });
    expect(seriesLogOffer(host({ selfReport: false }))).toEqual({
      disabledReason: null,
    });
  });

  it("disables it with the reason once decided or drawn (AC 6)", () => {
    expect(seriesLogOffer(facet({ decided: true, played: 2 }))).toEqual({
      disabledReason: SERIES_DECIDED,
    });
    expect(seriesLogOffer(host({ played: 3 }))).toEqual({
      disabledReason: SERIES_DRAWN,
    });
  });

  it("offers nothing to a non-Entrant, with self-report off, before the two Entrants are set, or Closed", () => {
    expect(
      seriesLogOffer(facet({ linked: { participantId: "cal", teamId: null } })),
    ).toBeNull();
    expect(seriesLogOffer(facet({ selfReport: false }))).toBeNull();
    expect(seriesLogOffer(host({ entrants: [ana] }))).toBeNull();
    expect(seriesLogOffer(host({ closed: true }))).toBeNull();
  });
});

describe("playersRuleError", () => {
  const entrants = [ana, ben];
  it("takes exactly the two Entrants, once each", () => {
    const rule = (ids: string[], list = entrants) =>
      playersRuleError({ scoring: "individual", ids, entrants: list });
    expect(rule(["ben", "ana"])).toBeNull();
    expect(rule(["ana", "ana"])).toBe(REPEATED_PLAYER);
    expect(rule(["ana"])).toBe(TWO_PLAYERS);
    expect(rule(["ana", "cal"])).toBe(NOT_AN_ENTRANT);
    expect(rule(["ana", "ben"], [ana])).toBe(NEEDS_TWO_ENTRANTS);
  });
});

describe("seriesChangeError", () => {
  const theirs = { players: [ana, ben] };

  it("lets either Entrant edit or delete a Match a Host logged for them (AC 11)", () => {
    expect(seriesChangeError(facet({ match: theirs }))).toBeNull();
    expect(
      seriesChangeError(
        facet({
          match: theirs,
          linked: { participantId: "ben", teamId: null },
          players: [],
        }),
      ),
    ).toBeNull();
  });

  it("lets them change it even once the series is decided (D1b)", () => {
    expect(
      seriesChangeError(facet({ match: theirs, decided: true, played: 2 })),
    ).toBeNull();
    expect(seriesChangeError(facet({ match: theirs, played: 3 }))).toBeNull();
  });

  it("refuses a non-Entrant, a missing Match, and self-report off", () => {
    expect(
      seriesChangeError(
        facet({
          match: theirs,
          linked: { participantId: "cal", teamId: null },
        }),
      ),
    ).toBe(NOT_A_PLAYER);
    expect(seriesChangeError(facet({ match: "missing" }))).toBe(MATCH_MISSING);
    expect(seriesChangeError(facet({ match: theirs, selfReport: false }))).toBe(
      SELF_REPORT_OFF,
    );
  });

  it("lets a Host change any Match while open, and nobody once Closed", () => {
    expect(seriesChangeError(host({ match: "missing" }))).toBeNull();
    expect(seriesChangeError(host({ match: theirs, closed: true }))).toBe(
      COMPETITION_CLOSED,
    );
    expect(seriesChangeError(facet({ match: theirs, closed: true }))).toBe(
      COMPETITION_CLOSED,
    );
  });
});
