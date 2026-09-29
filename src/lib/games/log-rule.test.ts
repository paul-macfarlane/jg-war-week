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
  gameChangeError,
  gameLogError,
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
