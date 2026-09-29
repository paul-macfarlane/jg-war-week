import { describe, expect, it } from "vitest";

import {
  BEST_OF_DECIDED,
  COMPETITION_CLOSED,
  GAME_MISSING,
  type GameLogFacet,
  LOGGING_CLOSED,
  NOT_AN_ENTRANT,
  NOT_A_PLAYER,
  NOT_LINKED,
  NOT_THE_LOGGER,
  canLogSomething,
  gameChangeError,
  gameLogError,
  onEntrantList,
  playersRuleError,
} from "@/lib/games/log-rule";

const ME = "participant-me";
const RIVAL = "participant-rival";
const THIRD = "participant-third";
const RED = "team-red";
const BLUE = "team-blue";
const GREEN = "team-green";

const player = (participantId: string) => ({ teamId: null, participantId });
const team = (teamId: string) => ({ teamId, participantId: null });

/** An open, individual-scoring Competition; I'm linked and in the Game. */
function facet(over: Partial<GameLogFacet> = {}): GameLogFacet {
  return {
    runs: false,
    closed: false,
    loggingOpen: true,
    bestOfDecided: false,
    linked: { participantId: ME, teamId: RED },
    scoring: "individual",
    entrantsOpen: true,
    entrants: [],
    players: [player(ME), player(RIVAL)],
    game: null,
    ...over,
  };
}

/** A team-scoring Competition with Red and Blue on a fixed list. */
function teamFacet(over: Partial<GameLogFacet> = {}): GameLogFacet {
  return facet({
    scoring: "team",
    entrantsOpen: false,
    entrants: [team(RED), team(BLUE)],
    players: [team(RED), team(BLUE)],
    ...over,
  });
}

/** Editing a Game I logged, keeping its players. */
function change(over: Partial<GameLogFacet> = {}): GameLogFacet {
  return facet({
    game: { loggedByParticipantId: ME, players: [player(ME), player(RIVAL)] },
    ...over,
  });
}

describe("gameLogError: logging a Game", () => {
  it("lets a linked Participant who is a player log it", () => {
    expect(gameLogError(facet())).toBeNull();
  });

  it("refuses the pick-only You: no account-linked Participant", () => {
    expect(gameLogError(facet({ linked: null }))).toBe(NOT_LINKED);
  });

  it("refuses a linked Participant who isn't a player in the Game", () => {
    expect(
      gameLogError(facet({ players: [player(RIVAL), player(THIRD)] })),
    ).toBe(NOT_A_PLAYER);
  });

  it("lets a Participant on a Team Entrant log for their Team", () => {
    expect(gameLogError(teamFacet())).toBeNull();
  });

  it("refuses a Participant whose Team isn't in the Game", () => {
    expect(
      gameLogError(teamFacet({ players: [team(BLUE), team(GREEN)] })),
    ).toBe(NOT_A_PLAYER);
  });

  it("refuses a Participant on no Team in team scoring", () => {
    expect(
      gameLogError(teamFacet({ linked: { participantId: ME, teamId: null } })),
    ).toBe(NOT_A_PLAYER);
  });

  it("on a fixed list, refuses a player who isn't an Entrant", () => {
    expect(gameLogError(teamFacet({ players: [team(RED), team(GREEN)] }))).toBe(
      NOT_AN_ENTRANT,
    );
    expect(
      gameLogError(
        facet({
          entrantsOpen: false,
          entrants: [player(ME), player(RIVAL)],
          players: [player(ME), player(THIRD)],
        }),
      ),
    ).toBe(NOT_AN_ENTRANT);
  });

  it("open to everyone, accepts any eligible player", () => {
    expect(
      gameLogError(facet({ players: [player(ME), player(THIRD)] })),
    ).toBeNull();
  });

  it("refuses a Participant after the logging close time", () => {
    expect(gameLogError(facet({ loggingOpen: false }))).toBe(LOGGING_CLOSED);
  });

  it("refuses a Participant once a Best of is decided", () => {
    expect(
      gameLogError(facet({ loggingOpen: false, bestOfDecided: true })),
    ).toBe(BEST_OF_DECIDED);
  });

  it("lets a Host or Organizer log any Game while open, logging closed or not", () => {
    expect(
      gameLogError(
        facet({
          runs: true,
          linked: null,
          loggingOpen: false,
          bestOfDecided: true,
          players: [player(RIVAL), player(THIRD)],
        }),
      ),
    ).toBeNull();
  });

  it("a closed Competition refuses everyone, a Host or Organizer included", () => {
    expect(gameLogError(facet({ closed: true }))).toBe(COMPETITION_CLOSED);
    expect(gameLogError(facet({ closed: true, runs: true }))).toBe(
      COMPETITION_CLOSED,
    );
  });
});

describe("gameChangeError: editing or deleting a Game", () => {
  it("lets the logger edit their own Game", () => {
    expect(gameChangeError(change())).toBeNull();
  });

  it("lets the logger delete their own Game", () => {
    expect(gameChangeError(change({ players: [] }))).toBeNull();
  });

  it("refuses another player in the Game: ask the Host", () => {
    const game = {
      loggedByParticipantId: RIVAL,
      players: [player(ME), player(RIVAL)],
    };
    expect(gameChangeError(change({ game }))).toBe(NOT_THE_LOGGER);
    expect(gameChangeError(change({ game, players: [] }))).toBe(NOT_THE_LOGGER);
  });

  it("refuses a Game logged by a Host (no logging Participant)", () => {
    expect(
      gameChangeError(
        change({
          game: {
            loggedByParticipantId: null,
            players: [player(ME), player(RIVAL)],
          },
        }),
      ),
    ).toBe(NOT_THE_LOGGER);
  });

  it("refuses the pick-only You", () => {
    expect(gameChangeError(change({ linked: null }))).toBe(NOT_LINKED);
  });

  it("refuses a Game that no longer exists", () => {
    expect(gameChangeError(change({ game: "missing" }))).toBe(GAME_MISSING);
    expect(gameChangeError(change({ game: null }))).toBe(GAME_MISSING);
  });

  it("refuses an edit that moves the Game off its logger", () => {
    expect(
      gameChangeError(change({ players: [player(RIVAL), player(THIRD)] })),
    ).toBe(NOT_A_PLAYER);
  });

  it("refuses the logger once the Host moved them out of the Game", () => {
    expect(
      gameChangeError(
        change({
          game: {
            loggedByParticipantId: ME,
            players: [player(RIVAL), player(THIRD)],
          },
          players: [],
        }),
      ),
    ).toBe(NOT_A_PLAYER);
  });

  it("on a fixed list, refuses an edit onto a non-Entrant", () => {
    expect(
      gameChangeError(
        change({
          entrantsOpen: false,
          entrants: [player(ME), player(RIVAL)],
          players: [player(ME), player(THIRD)],
        }),
      ),
    ).toBe(NOT_AN_ENTRANT);
  });

  it("lets a Participant on the logger's Team edit only if they logged it", () => {
    const game = {
      loggedByParticipantId: ME,
      players: [team(RED), team(BLUE)],
    };
    expect(gameChangeError(teamFacet({ game }))).toBeNull();
    expect(
      gameChangeError(
        teamFacet({
          game,
          linked: { participantId: RIVAL, teamId: RED },
        }),
      ),
    ).toBe(NOT_THE_LOGGER);
  });

  it("refuses the logger after logging closes or a Best of is decided", () => {
    expect(gameChangeError(change({ loggingOpen: false }))).toBe(
      LOGGING_CLOSED,
    );
    expect(
      gameChangeError(change({ loggingOpen: false, bestOfDecided: true })),
    ).toBe(BEST_OF_DECIDED);
  });

  it("lets a Host or Organizer edit or delete any Game while open", () => {
    const game = {
      loggedByParticipantId: RIVAL,
      players: [player(RIVAL), player(THIRD)],
    };
    expect(
      gameChangeError(
        change({ runs: true, linked: null, game, loggingOpen: false }),
      ),
    ).toBeNull();
    expect(
      gameChangeError(change({ runs: true, linked: null, game, players: [] })),
    ).toBeNull();
  });

  it("a closed Competition refuses everyone, a Host or Organizer included", () => {
    expect(gameChangeError(change({ closed: true }))).toBe(COMPETITION_CLOSED);
    expect(gameChangeError(change({ closed: true, runs: true }))).toBe(
      COMPETITION_CLOSED,
    );
  });
});

describe("onEntrantList", () => {
  const linked = { participantId: ME, teamId: RED };

  it("individual: the linked Participant is among the sides", () => {
    expect(onEntrantList("individual", linked, [player(ME)])).toBe(true);
    expect(onEntrantList("individual", linked, [player(RIVAL)])).toBe(false);
    expect(onEntrantList("individual", linked, [team(RED)])).toBe(false);
  });

  it("team: the linked Participant's Team is among the sides", () => {
    expect(onEntrantList("team", linked, [team(BLUE), team(RED)])).toBe(true);
    expect(onEntrantList("team", linked, [team(BLUE)])).toBe(false);
    expect(onEntrantList("team", linked, [player(ME)])).toBe(false);
  });

  it("team: a Participant on no Team is never on the list", () => {
    expect(
      onEntrantList("team", { participantId: ME, teamId: null }, [
        { teamId: null, participantId: ME },
      ]),
    ).toBe(false);
  });
});

describe("canLogSomething: whether a Log button shows", () => {
  it("lets a linked Participant log in an open Competition", () => {
    expect(canLogSomething(facet({ players: [] }))).toBe(true);
  });

  it("lets a Host log, but nobody once closed", () => {
    expect(canLogSomething(facet({ runs: true, linked: null }))).toBe(true);
    expect(canLogSomething(facet({ runs: true, closed: true }))).toBe(false);
  });

  it("refuses no link, logging closed, no Team in team scoring and off the fixed list", () => {
    expect(canLogSomething(facet({ linked: null }))).toBe(false);
    expect(canLogSomething(facet({ loggingOpen: false }))).toBe(false);
    expect(
      canLogSomething(
        teamFacet({ linked: { participantId: ME, teamId: null } }),
      ),
    ).toBe(false);
    expect(canLogSomething(teamFacet({ entrants: [team(BLUE)] }))).toBe(false);
    expect(canLogSomething(teamFacet())).toBe(true);
  });

  /**
   * Every facet in the table, checked against `gameLogError`: a Log button
   * shows exactly when some player set could be logged.
   */
  it("is true exactly when some player set passes gameLogError", () => {
    const subsets = <T>(items: T[]): T[][] =>
      items
        .reduce<T[][]>(
          (acc, item) => [...acc, ...acc.map((s) => [...s, item])],
          [[]],
        )
        .filter((s) => s.length > 0);
    const linkedOptions: GameLogFacet["linked"][] = [
      null,
      { participantId: ME, teamId: RED },
      { participantId: ME, teamId: null },
    ];
    let checked = 0;
    for (const scoring of ["individual", "team"] as const) {
      const sides: GameLogFacet["players"] =
        scoring === "team"
          ? [team(RED), team(BLUE), team(GREEN)]
          : [player(ME), player(RIVAL), player(THIRD)];
      const sets = subsets(sides);
      const entrantLists = [[], [sides[0]], [sides[1], sides[2]], sides];
      for (const closed of [false, true])
        for (const runs of [false, true])
          for (const loggingOpen of [false, true])
            for (const entrantsOpen of [false, true])
              for (const linked of linkedOptions)
                for (const entrants of entrantLists) {
                  const base: GameLogFacet = facet({
                    closed,
                    runs,
                    loggingOpen,
                    bestOfDecided: !loggingOpen,
                    linked,
                    scoring,
                    entrantsOpen,
                    entrants: entrantsOpen ? [] : entrants,
                    players: [],
                  });
                  const someSet = sets.some(
                    (players) => gameLogError({ ...base, players }) === null,
                  );
                  expect(canLogSomething(base), JSON.stringify(base)).toBe(
                    someSet,
                  );
                  checked++;
                }
    }
    expect(checked).toBe(2 * 2 * 2 * 2 * 2 * 3 * 4);
  });
});

describe("playersRuleError: the posted players' shape", () => {
  const ok = {
    gameType: "head-to-head" as const,
    scoring: "individual" as const,
    ids: [ME, RIVAL],
    allInWarWeek: true,
    bestOf: false,
    entrantsOpen: true,
    entrants: [],
  };

  it.each([
    ["accepts two distinct players, open to everyone", ok, null],
    [
      "refuses a repeated player",
      { ...ok, ids: [ME, ME] },
      "Choose each player only once.",
    ],
    [
      "refuses a head-to-head Game without exactly 2 players",
      { ...ok, ids: [ME, RIVAL, THIRD] },
      "A head-to-head Game has exactly 2 players.",
    ],
    [
      "refuses a best-score Game without exactly 1 player",
      { ...ok, gameType: "best-score" as const },
      "A best-score Game has exactly 1 player.",
    ],
    [
      "refuses a ranked Game with fewer than 2 players",
      { ...ok, gameType: "ranked" as const, ids: [ME] },
      "A ranked Game has at least 2 players.",
    ],
    [
      "accepts a ranked Game of 3",
      { ...ok, gameType: "ranked" as const, ids: [ME, RIVAL, THIRD] },
      null,
    ],
    [
      "refuses a Participant of another War Week",
      { ...ok, allInWarWeek: false },
      "Every player must be a Participant of this War Week.",
    ],
    [
      "refuses a Team of another War Week",
      {
        ...ok,
        scoring: "team" as const,
        ids: [RED, BLUE],
        allInWarWeek: false,
      },
      "Every player must be a Team of this War Week.",
    ],
    [
      "refuses a Best of open to everyone",
      { ...ok, bestOf: true },
      "A Best of is played between its 2 Entrants.",
    ],
    [
      "refuses a Best of without exactly 2 Entrants",
      {
        ...ok,
        bestOf: true,
        entrantsOpen: false,
        entrants: [player(ME), player(RIVAL), player(THIRD)],
      },
      "A Best of is played between its 2 Entrants.",
    ],
    [
      "accepts a Best of between its 2 Entrants",
      {
        ...ok,
        bestOf: true,
        entrantsOpen: false,
        entrants: [player(ME), player(RIVAL)],
      },
      null,
    ],
    [
      "refuses a player off the fixed list",
      {
        ...ok,
        entrantsOpen: false,
        entrants: [player(ME), player(THIRD)],
      },
      "Every player must be an Entrant of this Competition.",
    ],
    [
      "team: refuses a Team off the fixed list",
      {
        ...ok,
        scoring: "team" as const,
        ids: [RED, GREEN],
        entrantsOpen: false,
        entrants: [team(RED), team(BLUE)],
      },
      "Every player must be an Entrant of this Competition.",
    ],
  ])("%s", (_, facts, expected) => {
    expect(playersRuleError(facts)).toBe(expected);
  });
});
