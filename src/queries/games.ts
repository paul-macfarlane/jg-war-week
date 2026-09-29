import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  competitionHost,
  entrant,
  game,
  gamePlayer,
  organizer,
  participant,
  team,
} from "@/db/schema";
import type { GameType } from "@/lib/enums";
import {
  type GamesConfig,
  type HeadToHeadConfig,
  gamesConfigOf,
} from "@/lib/games/config";
import {
  type GameFact,
  type LeaderboardRow,
  bestOfWinner,
  rankGames,
} from "@/lib/games/leaderboard";
import {
  type GameLogFacet,
  type GameSide,
  gameChangeError,
} from "@/lib/games/log-rule";

/** Logging, or a Games settings write, on a Competition of another Format. */
export const NOT_GAMES = "This Competition isn't run as Games.";

type Scoring = GameLogFacet["scoring"];
type Linked = GameLogFacet["linked"];

/** A `games` Competition's facts, explicit columns only. */
export type GamesCompetition = {
  id: string;
  warWeekId: string;
  name: string;
  scoring: Scoring;
  gameType: GameType;
  config: GamesConfig;
  entrantsOpen: boolean;
  loggingClosesAt: Date | null;
  closed: boolean;
  placementPoints: number[] | null;
};

/** A Game with its logger's Participant (never the email) and its players. */
type LoadedGame = {
  id: string;
  loggedAt: Date;
  loggedByParticipantId: string | null;
  players: (GameSide & { place: number | null; score: number | null })[];
};

/** A player id as the ranking sees it: the Team or the Participant. */
const idOf = (side: GameSide) => (side.teamId ?? side.participantId)!;

/** A posted player id as a Game side, by the Competition's scoring. */
export function sideOf(scoring: Scoring, id: string): GameSide {
  return scoring === "team"
    ? { teamId: id, participantId: null }
    : { teamId: null, participantId: id };
}

async function loadGamesCompetition(
  competitionId: string,
  dbOrTx: DBOrTx,
): Promise<GamesCompetition | null> {
  const [found] = await dbOrTx
    .select({
      id: competition.id,
      warWeekId: competition.warWeekId,
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
      gameType: competition.gameType,
      gameConfig: competition.gameConfig,
      entrantsOpen: competition.entrantsOpen,
      loggingClosesAt: competition.loggingClosesAt,
      finalizedAt: competition.finalizedAt,
      placementPoints: competition.placementPoints,
    })
    .from(competition)
    .where(eq(competition.id, competitionId))
    .limit(1);
  if (!found || found.format !== "games" || !found.gameType) return null;
  return {
    id: found.id,
    warWeekId: found.warWeekId,
    name: found.name,
    scoring: found.scoring,
    gameType: found.gameType,
    config: gamesConfigOf({
      gameType: found.gameType,
      gameConfig: found.gameConfig,
    }),
    entrantsOpen: found.entrantsOpen,
    loggingClosesAt: found.loggingClosesAt,
    closed: found.finalizedAt !== null,
    placementPoints: found.placementPoints,
  };
}

function normalizedEmail(email: string | null | undefined): string | null {
  return email?.trim().toLowerCase() || null;
}

/**
 * Whether `email` runs this Competition: on the Organizer list or one of
 * its Hosts, read from the tables (in the caller's transaction), never
 * from the request.
 */
async function runsCompetition(
  competitionId: string,
  email: string | null,
  dbOrTx: DBOrTx,
): Promise<boolean> {
  if (!email) return false;
  const [organizers, hosts] = await Promise.all([
    dbOrTx.$count(organizer, eq(organizer.email, email)),
    dbOrTx.$count(
      competitionHost,
      and(
        eq(competitionHost.competitionId, competitionId),
        eq(competitionHost.email, email),
      ),
    ),
  ]);
  return organizers + hosts > 0;
}

/**
 * The Participant of the War Week whose email is `email`, ignoring case
 * (account linking; more than one match counts as none), with their Team.
 * Matches on the email without selecting it back.
 */
async function linkedIn(
  warWeekId: string,
  email: string | null,
  dbOrTx: DBOrTx,
): Promise<Linked> {
  if (!email) return null;
  const rows = await dbOrTx
    .select({ participantId: participant.id, teamId: participant.teamId })
    .from(participant)
    .where(
      and(
        eq(participant.warWeekId, warWeekId),
        eq(sql`lower(${participant.email})`, email),
      ),
    )
    .limit(2);
  return rows.length === 1 ? rows[0] : null;
}

async function entrantsOf(
  competitionIds: string[],
  dbOrTx: DBOrTx,
): Promise<(GameSide & { competitionId: string })[]> {
  if (competitionIds.length === 0) return [];
  return dbOrTx
    .select({
      competitionId: entrant.competitionId,
      teamId: entrant.teamId,
      participantId: entrant.participantId,
    })
    .from(entrant)
    .where(
      and(
        inArray(entrant.competitionId, competitionIds),
        isNull(entrant.squadId),
      ),
    )
    .orderBy(asc(entrant.seedPosition));
}

/** A Competition's Games, newest first, with their players. */
async function gamesOf(
  competitionIds: string[],
  dbOrTx: DBOrTx,
): Promise<(LoadedGame & { competitionId: string })[]> {
  if (competitionIds.length === 0) return [];
  const [games, players] = await Promise.all([
    dbOrTx
      .select({
        id: game.id,
        competitionId: game.competitionId,
        loggedAt: game.loggedAt,
        loggedByParticipantId: game.loggedByParticipantId,
      })
      .from(game)
      .where(inArray(game.competitionId, competitionIds))
      .orderBy(desc(game.loggedAt), desc(game.createdAt), asc(game.id)),
    dbOrTx
      .select({
        gameId: gamePlayer.gameId,
        teamId: gamePlayer.teamId,
        participantId: gamePlayer.participantId,
        place: gamePlayer.place,
        score: gamePlayer.score,
      })
      .from(gamePlayer)
      .innerJoin(game, eq(game.id, gamePlayer.gameId))
      .where(inArray(game.competitionId, competitionIds))
      .orderBy(asc(gamePlayer.place), asc(gamePlayer.id)),
  ]);
  const byGame = new Map<string, LoadedGame["players"]>();
  for (const { gameId, ...player } of players) {
    const list = byGame.get(gameId) ?? [];
    list.push(player);
    byGame.set(gameId, list);
  }
  return games.map((g) => ({ ...g, players: byGame.get(g.id) ?? [] }));
}

function factsOf(games: LoadedGame[]): GameFact[] {
  return games.map((g) => ({
    id: g.id,
    loggedAt: g.loggedAt,
    players: g.players.map((p) => ({
      id: idOf(p),
      place: p.place,
      score: p.score,
    })),
  }));
}

function bestOfOf(found: GamesCompetition): HeadToHeadConfig | null {
  if (found.gameType !== "head-to-head") return null;
  const config = found.config as HeadToHeadConfig;
  return config.bestOf === null ? null : config;
}

/** Whether logging is open for a Participant: the close time and Best of. */
function loggingState(
  found: GamesCompetition,
  games: LoadedGame[],
  now: Date,
): { loggingOpen: boolean; bestOfDecided: boolean; winnerId: string | null } {
  const bestOf = bestOfOf(found);
  const winnerId = bestOf ? bestOfWinner(bestOf, factsOf(games)) : null;
  const bestOfDecided = winnerId !== null;
  const pastClose =
    found.loggingClosesAt !== null &&
    now.getTime() > found.loggingClosesAt.getTime();
  return { loggingOpen: !pastClose && !bestOfDecided, bestOfDecided, winnerId };
}

export type GameLogFacts = {
  /** What `can("games.log" | "games.edit" | "games.delete", …)` checks. */
  gameLog: GameLogFacet;
  /** The Participant the email links to, or null; the same as the facet's. */
  linked: Linked;
  /** The Competition, or null when it's gone or not run as Games. */
  competition: GamesCompetition | null;
};

const REFUSING_FACET: GameLogFacet = {
  runs: false,
  closed: false,
  loggingOpen: false,
  bestOfDecided: false,
  linked: null,
  scoring: "individual",
  entrantsOpen: false,
  entrants: [],
  players: [],
  game: null,
};

/**
 * The facts a Game write is checked against (ADR 0006, R3 decisions 9 and
 * 10): whether `email` runs this Competition (the `organizer` and
 * `competition_host` tables, read in `dbOrTx`), whether it's closed,
 * whether logging is open for a Participant, the linked Participant of the
 * Competition's War Week, its Entrants, the posted players (`playerIds`,
 * as Teams or Participants by scoring; none for a delete) and, for an edit
 * or delete, the Game loaded by its id within this Competition.
 */
export async function getGameLogFacts(
  competitionId: string,
  gameId: string | null,
  email: string | null | undefined,
  { playerIds = [] }: { playerIds?: string[] } = {},
  dbOrTx: DBOrTx = db,
): Promise<GameLogFacts> {
  const found = await loadGamesCompetition(competitionId, dbOrTx);
  if (!found) {
    return { gameLog: REFUSING_FACET, linked: null, competition: null };
  }
  const normalized = normalizedEmail(email);
  const [runs, linked, entrants, games] = await Promise.all([
    runsCompetition(competitionId, normalized, dbOrTx),
    linkedIn(found.warWeekId, normalized, dbOrTx),
    entrantsOf([competitionId], dbOrTx),
    gamesOf([competitionId], dbOrTx),
  ]);
  const { loggingOpen, bestOfDecided } = loggingState(found, games, new Date());
  const loaded = gameId ? games.find((g) => g.id === gameId) : undefined;
  return {
    gameLog: {
      runs,
      closed: found.closed,
      loggingOpen,
      bestOfDecided,
      linked,
      scoring: found.scoring,
      entrantsOpen: found.entrantsOpen,
      entrants: entrants.map(({ teamId, participantId }) => ({
        teamId,
        participantId,
      })),
      players: playerIds.map((id) => sideOf(found.scoring, id)),
      game:
        gameId === null
          ? null
          : loaded
            ? {
                loggedByParticipantId: loaded.loggedByParticipantId,
                players: loaded.players.map(({ teamId, participantId }) => ({
                  teamId,
                  participantId,
                })),
              }
            : "missing",
    },
    linked,
    competition: found,
  };
}

/**
 * A `games` Competition's leaderboard rows (`rankGames`): every Entrant on
 * a fixed list, or everyone who has played when open. Empty when the
 * Competition is gone or not run as Games.
 */
export async function getGamesLeaderboard(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<LeaderboardRow[]> {
  const found = await loadGamesCompetition(competitionId, dbOrTx);
  if (!found) return [];
  const [entrants, games] = await Promise.all([
    entrantsOf([competitionId], dbOrTx),
    gamesOf([competitionId], dbOrTx),
  ]);
  return rankGames(
    found.gameType,
    found.config,
    factsOf(games),
    found.entrantsOpen ? null : entrants.map(idOf),
  );
}

/** A Team or Participant as a `games` page shows it: name and Team color. */
export type GamesViewName = { id: string; name: string; color: string | null };

export type GamesViewRow = LeaderboardRow & {
  name: string;
  color: string | null;
};

export type GamesViewPlayer = GamesViewName & {
  place: number | null;
  score: number | null;
};

export type GamesViewGame = {
  id: string;
  loggedAt: Date;
  players: GamesViewPlayer[];
  /** Whether the viewer may edit or delete this Game (`gameChangeError`). */
  canEdit: boolean;
  canDelete: boolean;
};

/**
 * Everything a `games` Competition's page shows, for one viewer. Names,
 * ids and booleans only: no email is ever selected (R3 decision 17).
 */
export type GamesView = {
  competition: GamesCompetition;
  /** Ranked best first; an Entrant with no Game is unranked, last. */
  leaderboard: GamesViewRow[];
  /** Newest first. */
  games: GamesViewGame[];
  /** The viewer's linked Participant and Team, for the "Mine" filter. */
  linked: Linked;
  /** The viewer is an Organizer or a Host of this Competition. */
  runs: boolean;
  /** Whether the viewer may log a Game right now (a Log button). */
  viewerCanLog: boolean;
  loggingOpen: boolean;
  bestOfDecided: boolean;
  /** The decided Best of's winner's name, or null. */
  bestOfWinner: string | null;
  /** Who the Game form offers: the Entrants, or everyone eligible when open. */
  entrantOptions: GamesViewName[];
};

/**
 * A `games` Competition's leaderboard, Game log and form options for
 * `viewerEmail` (null when anonymous), with `canEdit`/`canDelete` per Game
 * computed here. Null when the Competition is gone or not run as Games.
 */
export async function getGamesView(
  competitionId: string,
  viewerEmail: string | null,
  dbOrTx: DBOrTx = db,
): Promise<GamesView | null> {
  const found = await loadGamesCompetition(competitionId, dbOrTx);
  if (!found) return null;
  const email = normalizedEmail(viewerEmail);
  const [runs, linked, entrants, games, teams, participants] =
    await Promise.all([
      runsCompetition(competitionId, email, dbOrTx),
      linkedIn(found.warWeekId, email, dbOrTx),
      entrantsOf([competitionId], dbOrTx),
      gamesOf([competitionId], dbOrTx),
      dbOrTx
        .select({ id: team.id, name: team.name, color: team.color })
        .from(team)
        .where(eq(team.warWeekId, found.warWeekId))
        .orderBy(asc(team.name)),
      dbOrTx
        .select({
          id: participant.id,
          name: participant.displayName,
          teamId: participant.teamId,
        })
        .from(participant)
        .where(eq(participant.warWeekId, found.warWeekId))
        .orderBy(asc(participant.displayName)),
    ]);

  const colorOfTeam = new Map(teams.map((t) => [t.id, t.color]));
  const names = new Map<string, GamesViewName>();
  for (const t of teams) names.set(t.id, t);
  for (const p of participants) {
    names.set(p.id, {
      id: p.id,
      name: p.name,
      color: p.teamId ? (colorOfTeam.get(p.teamId) ?? null) : null,
    });
  }
  const nameOf = (id: string): GamesViewName =>
    names.get(id) ?? { id, name: "Unknown", color: null };

  const { loggingOpen, bestOfDecided, winnerId } = loggingState(
    found,
    games,
    new Date(),
  );
  const entrantSides = entrants.map(({ teamId, participantId }) => ({
    teamId,
    participantId,
  }));
  const facet: GameLogFacet = {
    runs,
    closed: found.closed,
    loggingOpen,
    bestOfDecided,
    linked,
    scoring: found.scoring,
    entrantsOpen: found.entrantsOpen,
    entrants: entrantSides,
    players: [],
    game: null,
  };

  const onList =
    linked !== null &&
    entrantSides.some((e) =>
      found.scoring === "team"
        ? linked.teamId !== null && e.teamId === linked.teamId
        : e.participantId === linked.participantId,
    );
  const viewerCanLog =
    !found.closed &&
    (runs ||
      (linked !== null &&
        loggingOpen &&
        (found.scoring === "individual" || linked.teamId !== null) &&
        (found.entrantsOpen || onList)));

  const rows = rankGames(
    found.gameType,
    found.config,
    factsOf(games),
    found.entrantsOpen ? null : entrants.map(idOf),
  );
  const options = found.entrantsOpen
    ? found.scoring === "team"
      ? teams
      : participants.map((p) => nameOf(p.id))
    : entrants.map((e) => nameOf(idOf(e)));

  return {
    competition: found,
    leaderboard: rows.map((row) => {
      const { name, color } = nameOf(row.id);
      return { ...row, name, color };
    }),
    games: games.map((g) => {
      const allowed =
        gameChangeError({
          ...facet,
          game: {
            loggedByParticipantId: g.loggedByParticipantId,
            players: g.players.map(({ teamId, participantId }) => ({
              teamId,
              participantId,
            })),
          },
        }) === null;
      return {
        id: g.id,
        loggedAt: g.loggedAt,
        players: g.players.map((p) => ({
          ...nameOf(idOf(p)),
          place: p.place,
          score: p.score,
        })),
        canEdit: allowed,
        canDelete: allowed,
      };
    }),
    linked,
    runs,
    viewerCanLog,
    loggingOpen,
    bestOfDecided,
    bestOfWinner: winnerId ? nameOf(winnerId).name : null,
    entrantOptions: options.map(({ id, name, color }) => ({ id, name, color })),
  };
}

export type LoggableCompetition = {
  id: string;
  name: string;
  gameType: GameType;
};

/**
 * The open `games` Competitions of a War Week where the Participant linked
 * to `email` may log a Game right now: not closed, logging open for them,
 * and they (or their Team) may play. Empty with no link. For the home
 * page's "Log a Game" card; ordered by name.
 */
export async function getLoggableCompetitions(
  warWeekId: string,
  email: string | null | undefined,
  dbOrTx: DBOrTx = db,
): Promise<LoggableCompetition[]> {
  const linked = await linkedIn(warWeekId, normalizedEmail(email), dbOrTx);
  if (!linked) return [];
  const ids = (
    await dbOrTx
      .select({ id: competition.id })
      .from(competition)
      .where(
        and(
          eq(competition.warWeekId, warWeekId),
          eq(competition.format, "games"),
          isNull(competition.finalizedAt),
        ),
      )
      .orderBy(asc(competition.name))
  ).map((c) => c.id);
  const [found, entrants, games] = await Promise.all([
    Promise.all(ids.map((id) => loadGamesCompetition(id, dbOrTx))),
    entrantsOf(ids, dbOrTx),
    gamesOf(ids, dbOrTx),
  ]);
  const now = new Date();
  return found.flatMap((c) => {
    if (!c || c.closed) return [];
    if (c.scoring === "team" && linked.teamId === null) return [];
    const own = games.filter((g) => g.competitionId === c.id);
    if (!loggingState(c, own, now).loggingOpen) return [];
    if (!c.entrantsOpen) {
      const onList = entrants.some(
        (e) =>
          e.competitionId === c.id &&
          (c.scoring === "team"
            ? e.teamId === linked.teamId
            : e.participantId === linked.participantId),
      );
      if (!onList) return [];
    }
    return [{ id: c.id, name: c.name, gameType: c.gameType }];
  });
}
