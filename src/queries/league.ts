/**
 * A League's reads (spec R23; execution plan P4): the page view one viewer
 * sees (`getLeagueView`), the facts a Match result write is checked
 * against (`getLeagueRecordFacts`) and what Close reads
 * (`getLeagueClose`). Every read is scoped to the Competition id, and a
 * Match to its Competition (P3a). Names, ids and booleans only: no email is
 * ever selected back (`recorded_by_email` is audit only).
 */
import { and, asc, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, entrant, leagueMatch, participant } from "@/db/schema";
import { pointsFor } from "@/lib/bracket/points";
import type { LeagueResult, ScoreDirection } from "@/lib/enums";
import {
  type LeagueConfig,
  leagueConfigOf,
  roundsOf,
  swissDefaultRounds,
} from "@/lib/league/config";
import type { LeagueMatchFacts } from "@/lib/league/pairing";
import {
  type LeagueRecordFacet,
  ROUND_HAS_RESULT,
  SWAPPED_MATCH_HAS_RESULT,
  clearPairingsError,
  leagueRecordError,
  pairError,
  pairNextError,
  unplayedSummary,
} from "@/lib/league/rules";
import {
  type LeagueStandingsRow,
  leaguePlacings,
  leagueStandings,
} from "@/lib/league/standings";
import { entryPointsFor } from "@/lib/results-table";
import { COMPETITION_CLOSED, type MatchSide } from "@/lib/series/log-rule";
import { isUuid } from "@/lib/uuid";
import { getBracketEntrants } from "@/queries/brackets";
import { getCompetitionEntryPoints } from "@/queries/entry-points";
import { getHostedCompetitions, isOrganizerEmail } from "@/queries/organizers";

type Linked = { participantId: string; teamId: string | null } | null;

/** A League Competition's facts, explicit columns only. */
export type LeagueCompetition = {
  id: string;
  warWeekId: string;
  name: string;
  scoring: "team" | "individual";
  config: LeagueConfig;
  scoreDirection: ScoreDirection;
  scoreUnit: string | null;
  /** "Participants can log their own results". */
  selfReport: boolean;
  closed: boolean;
  placementPoints: number[] | null;
};

/** A League Match row as the reads use it (never who recorded it). */
export type LeagueMatchRow = LeagueMatchFacts & {
  id: string;
  position: number;
  scoreA: number | null;
  scoreB: number | null;
  recordedAt: Date | null;
};

/** A League by id, or null when it's gone or run as another Format. */
export async function getLeagueCompetition(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<LeagueCompetition | null> {
  if (!isUuid(competitionId)) return null;
  const [found] = await dbOrTx
    .select({
      id: competition.id,
      warWeekId: competition.warWeekId,
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
      leagueConfig: competition.leagueConfig,
      scoreDirection: competition.scoreDirection,
      scoreUnit: competition.scoreUnit,
      selfReport: competition.selfReport,
      closedAt: competition.closedAt,
      placementPoints: competition.placementPoints,
    })
    .from(competition)
    .where(eq(competition.id, competitionId))
    .limit(1);
  if (!found || found.format !== "league") return null;
  return {
    id: found.id,
    warWeekId: found.warWeekId,
    name: found.name,
    scoring: found.scoring,
    config: leagueConfigOf(found),
    scoreDirection: found.scoreDirection,
    scoreUnit: found.scoreUnit,
    selfReport: found.selfReport,
    closed: found.closedAt !== null,
    placementPoints: found.placementPoints,
  };
}

/** A League's Matches in round and position order. */
export async function getLeagueMatches(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<LeagueMatchRow[]> {
  return dbOrTx
    .select({
      id: leagueMatch.id,
      round: leagueMatch.round,
      position: leagueMatch.position,
      a: leagueMatch.entrantAId,
      b: leagueMatch.entrantBId,
      result: leagueMatch.result,
      scoreA: leagueMatch.scoreA,
      scoreB: leagueMatch.scoreB,
      recordedAt: leagueMatch.recordedAt,
    })
    .from(leagueMatch)
    .where(eq(leagueMatch.competitionId, competitionId))
    .orderBy(asc(leagueMatch.round), asc(leagueMatch.position));
}

/**
 * Whether `email` runs this Competition: on the Organizer list or one of
 * its Hosts, read from the tables (in the caller's transaction).
 */
async function runsCompetition(
  competitionId: string,
  email: string | null,
  dbOrTx: DBOrTx,
): Promise<boolean> {
  if (!email) return false;
  if (await isOrganizerEmail(email, dbOrTx)) return true;
  const hosted = await getHostedCompetitions(email, dbOrTx);
  return hosted.some((h) => h.competitionId === competitionId);
}

/**
 * The Participant of the War Week whose email is `email`, ignoring case
 * (account linking; more than one match counts as none), with their Team.
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

const normalized = (email: string | null | undefined) =>
  email?.trim().toLowerCase() || null;

/** A League's Entrant rows as Match sides, by Entrant id. */
async function sidesOf(
  competitionId: string,
  dbOrTx: DBOrTx,
): Promise<Map<string, MatchSide>> {
  const rows = await dbOrTx
    .select({
      id: entrant.id,
      teamId: entrant.teamId,
      participantId: entrant.participantId,
    })
    .from(entrant)
    .where(eq(entrant.competitionId, competitionId));
  return new Map(
    rows.map((r) => [
      r.id,
      { teamId: r.teamId, participantId: r.participantId },
    ]),
  );
}

/** A Match's facet sides, or null for a Match not in this League. */
function matchFacetOf(
  match: LeagueMatchRow | undefined,
  sides: Map<string, MatchSide>,
): LeagueRecordFacet["match"] {
  if (!match) return null;
  const side = (id: string): MatchSide =>
    sides.get(id) ?? { teamId: null, participantId: null };
  return { a: side(match.a), b: match.b === null ? null : side(match.b) };
}

export type LeagueRecordFacts = {
  /** What `can("league.record" | "league.clear", …)` checks. */
  leagueRecord: LeagueRecordFacet;
  linked: Linked;
  competition: LeagueCompetition;
  /** The Match, found within this League only; null when it isn't. */
  match: LeagueMatchRow | null;
};

/**
 * The facts a League Match result write (record, edit or clear) is
 * checked against (spec R23, decision 8): whether `email` runs this
 * Competition (read in `dbOrTx`), whether it's closed, self-report, the
 * linked Participant, and the Match loaded by its id within this
 * Competition (P3a: another Competition's Match id is missing). Null when
 * the Competition isn't a League.
 */
export async function getLeagueRecordFacts(
  competitionId: string,
  matchId: string,
  email: string | null | undefined,
  dbOrTx: DBOrTx = db,
): Promise<LeagueRecordFacts | null> {
  const found = await getLeagueCompetition(competitionId, dbOrTx);
  if (!found) return null;
  const actor = normalized(email);
  const [runs, linked, sides, rows] = await Promise.all([
    runsCompetition(competitionId, actor, dbOrTx),
    linkedIn(found.warWeekId, actor, dbOrTx),
    sidesOf(competitionId, dbOrTx),
    isUuid(matchId)
      ? dbOrTx
          .select({
            id: leagueMatch.id,
            round: leagueMatch.round,
            position: leagueMatch.position,
            a: leagueMatch.entrantAId,
            b: leagueMatch.entrantBId,
            result: leagueMatch.result,
            scoreA: leagueMatch.scoreA,
            scoreB: leagueMatch.scoreB,
            recordedAt: leagueMatch.recordedAt,
          })
          .from(leagueMatch)
          .where(
            and(
              eq(leagueMatch.id, matchId),
              eq(leagueMatch.competitionId, competitionId),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
  ]);
  const match = rows[0] ?? null;
  return {
    leagueRecord: {
      runs,
      closed: found.closed,
      selfReport: found.selfReport,
      linked,
      scoring: found.scoring,
      match: matchFacetOf(match ?? undefined, sides),
    },
    linked,
    competition: found,
    match,
  };
}

/** What Close reads about a League: its Entrants by name, and its Matches. */
export async function getLeagueClose(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<{
  entrants: {
    id: string;
    name: string;
    teamId: string | null;
    participantId: string | null;
  }[];
  matches: LeagueMatchFacts[];
}> {
  const [entrants, matches] = await Promise.all([
    getBracketEntrants(competitionId, dbOrTx),
    getLeagueMatches(competitionId, dbOrTx),
  ]);
  return {
    entrants: entrants.map((e) => ({
      id: e.id,
      name: e.label,
      teamId: e.teamId,
      participantId: e.participantId,
    })),
    matches: matches.map(({ round, a, b, result }) => ({
      round,
      a,
      b,
      result,
    })),
  };
}

/** A button the run area offers, with why it's disabled (null: enabled). */
export type LeagueOffer = { label: string; disabledReason: string | null };

/** An Entrant as the League page shows it: names only, never an email. */
export type LeagueEntrantView = {
  id: string;
  seedPosition: number;
  name: string;
  teamId: string | null;
  participantId: string | null;
  /** A Participant Entrant's Team name; null for a Team or none. */
  team: string | null;
  /** The Team's color (a Participant's Team's), or null. */
  color: string | null;
  /** A Participant's picture URL; null for initials and for Teams. */
  image: string | null;
};

/** One Match of a round, for one viewer. */
export type LeagueMatchView = {
  id: string;
  round: number;
  /** Order in the round, from 0. */
  position: number;
  /** Entrant A's id. */
  a: string;
  /** Entrant B's id; null for a bye (Swiss) or sit-out (round robin). */
  b: string | null;
  result: LeagueResult | null;
  scoreA: number | null;
  scoreB: number | null;
  /** When the result was last saved; null until it has one. */
  recordedAt: Date | null;
  /** The viewer may record (or change) its result (`leagueRecordError`). */
  canRecord: boolean;
  /** The viewer may clear its result: `canRecord` and it has one. */
  canClear: boolean;
  /** The viewer (or their Team) plays in it. */
  yours: boolean;
};

export type LeagueRoundView = {
  round: number;
  matches: LeagueMatchView[];
  /**
   * Why Edit pairings is off for this round (Closed; a Swiss round with a
   * result; a round robin round with fewer than two Matches still open), or
   * null. Only meaningful to an Organizer or Host (`runs`); the server
   * checks each swap again (`swapError`).
   */
  editDisabledReason: string | null;
};

/** A standings row with names and War Week points, for one viewer. */
export type LeagueStandingsView = LeagueStandingsRow & {
  name: string;
  team: string | null;
  color: string | null;
  image: string | null;
  /**
   * War Week points: while open, the Provisional points Close would award
   * (null for all until a Match has a result); once Closed, what its
   * generated Points Entries add up to. Null when it earns none.
   */
  points: number | null;
  yours: boolean;
};

/** The viewer's next Match: its round and opponent, or a bye. */
export type LeagueNextMatch = {
  round: number;
  matchId: string;
  /** The opponent's name; null for a bye or sit-out. */
  opponent: string | null;
};

export type LeagueView = {
  competition: LeagueCompetition;
  /** How many rounds the League plays with its Entrants (`roundsOf`). */
  roundsTotal: number;
  /** How many rounds are paired so far. */
  roundsPaired: number;
  /** A Swiss League's default rounds for its Entrants, ⌈log₂ N⌉. */
  swissDefaultRounds: number;
  /** In Seed Position order. */
  entrants: LeagueEntrantView[];
  /** Round 1 first; Matches in position order. */
  rounds: LeagueRoundView[];
  /** Best first (`leagueStandings`), tied rows sharing a rank. */
  standings: LeagueStandingsView[];
  /** Points are Provisional (not yet Closed). */
  provisional: boolean;
  /** The viewer is an Organizer or a Host of this Competition. */
  runs: boolean;
  /** The viewer's linked Participant and Team. */
  linked: Linked;
  /** The viewer's Entrant (themselves, or their Team), or null. */
  yourEntrantId: string | null;
  /** The viewer's next Match while open, or null. */
  yourNextMatch: LeagueNextMatch | null;
  /**
   * The run area's buttons for an Organizer or Host (all null for anyone
   * else): "Pair rounds" / "Pair round 1" before any pairing, "Pair next
   * round" (Swiss, once paired), "Clear pairings" (once paired), Close
   * (open; disabled with `unplayedSummary`'s reason until complete) or
   * Reopen (Closed).
   */
  offers: {
    pair: LeagueOffer | null;
    pairNext: LeagueOffer | null;
    clearPairings: LeagueOffer | null;
    close: LeagueOffer | null;
    reopen: LeagueOffer | null;
  };
};

/** Whether an Entrant row is the linked viewer (or their Team). */
function isViewer(
  scoring: "team" | "individual",
  linked: Linked,
  side: { teamId: string | null; participantId: string | null },
): boolean {
  if (!linked) return false;
  return scoring === "team"
    ? linked.teamId !== null && side.teamId === linked.teamId
    : side.participantId === linked.participantId;
}

/** Why Edit pairings is off for `round`, or null (reading R7). */
function editDisabledReason(
  found: LeagueCompetition,
  round: LeagueMatchRow[],
): string | null {
  if (found.closed) return COMPETITION_CLOSED;
  if (found.config.pairing === "swiss") {
    return round.some((m) => m.result !== null) ? ROUND_HAS_RESULT : null;
  }
  const open = round.filter((m) => m.result === null).length;
  return open >= 2 ? null : SWAPPED_MATCH_HAS_RESULT;
}

/**
 * Everything a League's pages show, for `viewerEmail` (null when
 * anonymous): its settings, Entrants, rounds with each Match's
 * `canRecord` / `canClear`, standings with tiebreaks and points, the
 * viewer's next Match and the run area's offers with their disabled
 * reasons (the same rules the server refuses with). Null when the
 * Competition is gone or another Format.
 */
export async function getLeagueView(
  competitionId: string,
  viewerEmail: string | null,
  dbOrTx: DBOrTx = db,
): Promise<LeagueView | null> {
  const found = await getLeagueCompetition(competitionId, dbOrTx);
  if (!found) return null;
  const email = normalized(viewerEmail);
  const [runs, linked, entrantRows, matches, entryPoints] = await Promise.all([
    runsCompetition(competitionId, email, dbOrTx),
    linkedIn(found.warWeekId, email, dbOrTx),
    getBracketEntrants(competitionId, dbOrTx),
    getLeagueMatches(competitionId, dbOrTx),
    found.closed
      ? getCompetitionEntryPoints(competitionId, dbOrTx)
      : Promise.resolve([]),
  ]);

  const entrants: LeagueEntrantView[] = entrantRows.map((e) => ({
    id: e.id,
    seedPosition: e.seedPosition,
    name: e.label,
    teamId: e.teamId,
    participantId: e.participantId,
    team: e.teamId ? null : e.teamName,
    color: e.color,
    image: e.image ?? null,
  }));
  const byId = new Map(entrants.map((e) => [e.id, e]));
  const nameOf = (id: string) => byId.get(id)?.name ?? "Unknown";
  const sides = new Map(
    entrants.map((e) => [
      e.id,
      { teamId: e.teamId, participantId: e.participantId },
    ]),
  );
  const yours = entrants.find((e) => isViewer(found.scoring, linked, e));
  const yourEntrantId = yours?.id ?? null;
  const n = entrants.length;

  const facetBase = {
    runs,
    closed: found.closed,
    selfReport: found.selfReport,
    linked,
    scoring: found.scoring,
  };
  const matchView = (m: LeagueMatchRow): LeagueMatchView => {
    const canRecord =
      leagueRecordError({ ...facetBase, match: matchFacetOf(m, sides) }) ===
      null;
    return {
      id: m.id,
      round: m.round,
      position: m.position,
      a: m.a,
      b: m.b,
      result: m.result,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      recordedAt: m.recordedAt,
      canRecord,
      canClear: canRecord && m.result !== null,
      yours:
        yourEntrantId !== null &&
        (m.a === yourEntrantId || m.b === yourEntrantId),
    };
  };
  const roundNumbers = [...new Set(matches.map((m) => m.round))].sort(
    (x, y) => x - y,
  );
  const rounds: LeagueRoundView[] = roundNumbers.map((round) => {
    const inRound = matches.filter((m) => m.round === round);
    return {
      round,
      matches: inRound.map(matchView),
      editDisabledReason: editDisabledReason(found, inRound),
    };
  });

  const facts: LeagueMatchFacts[] = matches.map(({ round, a, b, result }) => ({
    round,
    a,
    b,
    result,
  }));
  const rows = leagueStandings(
    found.config.pairing,
    entrants.map((e) => e.id),
    facts,
  );
  const anyResult = matches.some((m) => m.result !== null);
  const provisional = new Map(
    anyResult
      ? pointsFor(leaguePlacings(rows), found).map((p) => [
          p.entrantId,
          p.points,
        ])
      : [],
  );
  const standings: LeagueStandingsView[] = rows.map((row) => {
    const e = byId.get(row.entrantId)!;
    return {
      ...row,
      name: e.name,
      team: e.team,
      color: e.color,
      image: e.image,
      points: found.closed
        ? entryPointsFor(entryPoints, e)
        : (provisional.get(row.entrantId) ?? null),
      yours: row.entrantId === yourEntrantId,
    };
  });

  const yourNextMatch = ((): LeagueNextMatch | null => {
    if (found.closed || yourEntrantId === null) return null;
    const roundOpen = (round: number) =>
      matches.some(
        (m) => m.round === round && m.b !== null && m.result === null,
      );
    for (const m of matches) {
      if (m.a !== yourEntrantId && m.b !== yourEntrantId) continue;
      if (m.b === null) {
        if (roundOpen(m.round)) {
          return { round: m.round, matchId: m.id, opponent: null };
        }
        continue;
      }
      if (m.result !== null) continue;
      const opponent = m.a === yourEntrantId ? m.b : m.a;
      return { round: m.round, matchId: m.id, opponent: nameOf(opponent) };
    }
    return null;
  })();

  const pairFacet = {
    closed: found.closed,
    config: found.config,
    entrantCount: n,
    matches: facts,
  };
  const paired = matches.length > 0;
  const swiss = found.config.pairing === "swiss";
  const offers: LeagueView["offers"] = runs
    ? {
        pair: paired
          ? null
          : {
              label: swiss ? "Pair round 1" : "Pair rounds",
              disabledReason: pairError(pairFacet),
            },
        pairNext:
          swiss && paired
            ? {
                label: "Pair next round",
                disabledReason: pairNextError(pairFacet),
              }
            : null,
        clearPairings: paired
          ? {
              label: "Clear pairings",
              disabledReason: clearPairingsError({
                closed: found.closed,
                matches,
              }),
            }
          : null,
        close: found.closed
          ? null
          : {
              label: "Close",
              disabledReason: unplayedSummary({
                config: found.config,
                entrantCount: n,
                matches: facts,
                nameOf,
              }),
            },
        reopen: found.closed ? { label: "Reopen", disabledReason: null } : null,
      }
    : {
        pair: null,
        pairNext: null,
        clearPairings: null,
        close: null,
        reopen: null,
      };

  return {
    competition: found,
    roundsTotal: n < 2 ? 0 : roundsOf(found.config, n),
    roundsPaired: roundNumbers.length,
    swissDefaultRounds: swissDefaultRounds(n),
    entrants,
    rounds,
    standings,
    provisional: !found.closed,
    runs,
    linked,
    yourEntrantId,
    yourNextMatch,
    offers,
  };
}
