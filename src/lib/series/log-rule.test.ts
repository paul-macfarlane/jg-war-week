import { describe, expect, it } from "vitest";

import {
  COMPETITION_CLOSED,
  MATCH_MISSING,
  NEEDS_TWO_ENTRANTS,
  NOT_AN_ENTRANT,
  NOT_A_PLAYER,
  NOT_LINKED,
  NOT_THE_LOGGER,
  REPEATED_PLAYER,
  SERIES_DECIDED,
  type SeriesLogFacet,
  TWO_PLAYERS,
  canLogMatch,
  playersRuleError,
  seriesChangeError,
  seriesLogError,
} from "@/lib/series/log-rule";

const ana = { teamId: null, participantId: "ana" };
const ben = { teamId: null, participantId: "ben" };
const cal = { teamId: null, participantId: "cal" };

/** Ana and Ben's series; I'm Ana, linked; I post a Match against Ben. */
function facet(over: Partial<SeriesLogFacet> = {}): SeriesLogFacet {
  return {
    runs: false,
    closed: false,
    decided: false,
    linked: { participantId: "ana", teamId: "red" },
    scoring: "individual",
    entrants: [ana, ben],
    players: [ana, ben],
    match: null,
    ...over,
  };
}

describe("seriesLogError", () => {
  it("lets either Entrant log a Match between the two", () => {
    expect(seriesLogError(facet())).toBeNull();
    expect(
      seriesLogError(facet({ linked: { participantId: "ben", teamId: null } })),
    ).toBeNull();
  });

  it("binds everyone once closed, and lets a Host log otherwise", () => {
    expect(seriesLogError(facet({ runs: true, closed: true }))).toBe(
      COMPETITION_CLOSED,
    );
    expect(
      seriesLogError(facet({ runs: true, linked: null, decided: true })),
    ).toBeNull();
  });

  it("refuses no link, a decided series, a non-player and a non-Entrant", () => {
    expect(seriesLogError(facet({ linked: null }))).toBe(NOT_LINKED);
    expect(seriesLogError(facet({ decided: true }))).toBe(SERIES_DECIDED);
    expect(
      seriesLogError(facet({ linked: { participantId: "cal", teamId: null } })),
    ).toBe(NOT_A_PLAYER);
    expect(seriesLogError(facet({ players: [ana, cal] }))).toBe(NOT_AN_ENTRANT);
  });

  it("in team scoring, anyone on an Entrant Team may log", () => {
    const red = { teamId: "red", participantId: null };
    const blue = { teamId: "blue", participantId: null };
    expect(
      seriesLogError(
        facet({ scoring: "team", entrants: [red, blue], players: [red, blue] }),
      ),
    ).toBeNull();
  });
});

describe("canLogMatch", () => {
  it("needs the two Entrants, for everyone", () => {
    expect(canLogMatch(facet())).toBe(true);
    expect(canLogMatch(facet({ entrants: [ana] }))).toBe(false);
    expect(canLogMatch(facet({ runs: true, entrants: [] }))).toBe(false);
    expect(canLogMatch(facet({ runs: true }))).toBe(true);
  });

  it("is off for a non-Entrant and once decided", () => {
    expect(
      canLogMatch(facet({ linked: { participantId: "cal", teamId: null } })),
    ).toBe(false);
    expect(canLogMatch(facet({ decided: true }))).toBe(false);
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
  const mine = { loggedByParticipantId: "ana", players: [ana, ben] };

  it("lets the logger edit or delete their Match", () => {
    expect(seriesChangeError(facet({ match: mine }))).toBeNull();
    expect(seriesChangeError(facet({ match: mine, players: [] }))).toBeNull();
  });

  it("refuses another player, a missing Match and a decided series", () => {
    expect(
      seriesChangeError(
        facet({ match: { ...mine, loggedByParticipantId: "ben" } }),
      ),
    ).toBe(NOT_THE_LOGGER);
    expect(seriesChangeError(facet({ match: "missing" }))).toBe(MATCH_MISSING);
    expect(seriesChangeError(facet({ match: mine, decided: true }))).toBe(
      SERIES_DECIDED,
    );
  });

  it("lets a Host change any Match until Closed", () => {
    expect(
      seriesChangeError(facet({ runs: true, linked: null, match: "missing" })),
    ).toBeNull();
    expect(
      seriesChangeError(facet({ runs: true, closed: true, match: mine })),
    ).toBe(COMPETITION_CLOSED);
  });
});
