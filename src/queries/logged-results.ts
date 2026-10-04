import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  attempt,
  competition,
  entrant,
  participant,
  seriesMatch,
  seriesMatchEntrant,
  team,
} from "@/db/schema";
import {
  type BestScoreSettings,
  bestScoreSettingsOf,
} from "@/lib/best-score/config";
import {
  type AttemptLogFacet,
  attemptChangeError,
  attemptLogOffer,
} from "@/lib/best-score/log-rule";
import {
  type AttemptFact,
  rankAttempts,
  rowIdOf,
} from "@/lib/best-score/standings";
import { pointsFor } from "@/lib/bracket/points";
import { LOGGED_FORMATS, type LoggedFormat, isLoggedFormat } from "@/lib/enums";
import {
  type ResultFact,
  type StandingsRow,
  placingsOf,
} from "@/lib/logged-results";
import { entryPointsFor } from "@/lib/results-table";
import { type ScoringConfig, scoringOf } from "@/lib/scoring";
import { type SeriesConfig, seriesConfigOf } from "@/lib/series/config";
import {
  type MatchSide,
  type SeriesLogFacet,
  seriesChangeError,
  seriesLogOffer,
} from "@/lib/series/log-rule";
import { bestOfWinner, rankSeries } from "@/lib/series/standings";
import { isUuid } from "@/lib/uuid";
import { getCompetitionEntryPoints } from "@/queries/entry-points";
import { getHostedCompetitions, isOrganizerEmail } from "@/queries/organizers";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

type Scoring = "team" | "individual";
type Linked = { participantId: string; teamId: string | null } | null;

/** A Head-to-head's draws and Best of, or Best score's direction, unit and Team score. */
export type LoggedConfig = SeriesConfig | BestScoreSettings;

/** A Head-to-head or Best score Competition's facts, explicit columns only. */
export type LoggedCompetition = {
  id: string;
  warWeekId: string;
  name: string;
  scoring: Scoring;
  format: LoggedFormat;
  config: LoggedConfig;
  /** The Score direction and unit (Head-to-head Matches use them too). */
  scoringConfig: ScoringConfig;
  /** "Participants can log their own results". */
  selfReport: boolean;
  /** Best score's "Max attempts per person"; null for no limit. */
  maxAttempts: number | null;
  closed: boolean;
  placementPoints: number[] | null;
};

/** A series Match with its logger's Participant (never the email) and its two sides. */
type LoadedMatch = {
  id: string;
  competitionId: string;
  recordedAt: Date;
  loggedByParticipantId: string | null;
  players: (MatchSide & { place: number | null; score: number | null })[];
};

/** An Attempt with its logger's Participant (never the email). */
type LoadedAttempt = AttemptFact & {
  competitionId: string;
  loggedByParticipantId: string | null;
};

/** A side's id as the standings see it: the Team or the Participant. */
const idOf = (side: MatchSide) => (side.teamId ?? side.participantId)!;

/** A posted player id as a Match side, by the Competition's scoring. */
export function sideOf(scoring: Scoring, id: string): MatchSide {
  return scoring === "team"
    ? { teamId: id, participantId: null }
    : { teamId: null, participantId: id };
}

async function loadCompetitions(
  ids: string[],
  dbOrTx: DBOrTx,
): Promise<LoggedCompetition[]> {
  const valid = ids.filter(isUuid);
  if (valid.length === 0) return [];
  const rows = await dbOrTx
    .select({
      id: competition.id,
      warWeekId: competition.warWeekId,
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
      seriesConfig: competition.seriesConfig,
      scoreDirection: competition.scoreDirection,
      scoreUnit: competition.scoreUnit,
      bestScoreConfig: competition.bestScoreConfig,
      selfReport: competition.selfReport,
      maxAttempts: competition.maxAttempts,
      closedAt: competition.closedAt,
      placementPoints: competition.placementPoints,
    })
    .from(competition)
    .where(inArray(competition.id, valid))
    .orderBy(asc(competition.name));
  return rows.flatMap((found) => {
    if (!isLoggedFormat(found.format)) return [];
    return [
      {
        id: found.id,
        warWeekId: found.warWeekId,
        name: found.name,
        scoring: found.scoring,
        format: found.format,
        config:
          found.format === "head-to-head"
            ? seriesConfigOf(found)
            : bestScoreSettingsOf(found),
        scoringConfig: scoringOf(found),
        selfReport: found.selfReport,
        maxAttempts: found.maxAttempts,
        closed: found.closedAt !== null,
        placementPoints: found.placementPoints,
      },
    ];
  });
}

/**
 * A Head-to-head or Best score Competition by id, or null when it's gone
 * or run as another Format.
 */
export async function getLoggedCompetition(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<LoggedCompetition | null> {
  const [found] = await loadCompetitions([competitionId], dbOrTx);
  return found ?? null;
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
  if (await isOrganizerEmail(email, dbOrTx)) return true;
  // The one Host rule (ADR 0012), shared with the admin gate.
  const hosted = await getHostedCompetitions(email, dbOrTx);
  return hosted.some((h) => h.competitionId === competitionId);
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

/** A Head-to-head's Entrants (its two sides), in Seed Position order. */
async function entrantsOf(
  competitionIds: string[],
  dbOrTx: DBOrTx,
): Promise<(MatchSide & { id: string; competitionId: string })[]> {
  if (competitionIds.length === 0) return [];
  return dbOrTx
    .select({
      id: entrant.id,
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

/** Head-to-head Matches, newest first, each with its two sides. */
async function matchesOf(
  competitionIds: string[],
  dbOrTx: DBOrTx,
): Promise<LoadedMatch[]> {
  if (competitionIds.length === 0) return [];
  const [matches, sides] = await Promise.all([
    dbOrTx
      .select({
        id: seriesMatch.id,
        competitionId: seriesMatch.competitionId,
        recordedAt: seriesMatch.recordedAt,
        loggedByParticipantId: seriesMatch.loggedByParticipantId,
      })
      .from(seriesMatch)
      .where(inArray(seriesMatch.competitionId, competitionIds))
      .orderBy(
        desc(seriesMatch.recordedAt),
        desc(seriesMatch.createdAt),
        asc(seriesMatch.id),
      ),
    dbOrTx
      .select({
        seriesMatchId: seriesMatchEntrant.seriesMatchId,
        teamId: entrant.teamId,
        participantId: entrant.participantId,
        place: seriesMatchEntrant.place,
        score: seriesMatchEntrant.score,
      })
      .from(seriesMatchEntrant)
      .innerJoin(
        seriesMatch,
        eq(seriesMatch.id, seriesMatchEntrant.seriesMatchId),
      )
      .innerJoin(entrant, eq(entrant.id, seriesMatchEntrant.entrantId))
      .where(inArray(seriesMatch.competitionId, competitionIds))
      .orderBy(asc(seriesMatchEntrant.place), asc(entrant.seedPosition)),
  ]);
  const byMatch = new Map<string, LoadedMatch["players"]>();
  for (const { seriesMatchId, ...side } of sides) {
    byMatch.set(seriesMatchId, [...(byMatch.get(seriesMatchId) ?? []), side]);
  }
  return matches.map((m) => ({ ...m, players: byMatch.get(m.id) ?? [] }));
}

/** Best score Attempts, newest first. */
async function attemptsOf(
  competitionIds: string[],
  dbOrTx: DBOrTx,
): Promise<LoadedAttempt[]> {
  if (competitionIds.length === 0) return [];
  return dbOrTx
    .select({
      id: attempt.id,
      competitionId: attempt.competitionId,
      recordedAt: attempt.recordedAt,
      loggedByParticipantId: attempt.loggedByParticipantId,
      participantId: attempt.participantId,
      teamId: attempt.teamId,
      score: attempt.score,
    })
    .from(attempt)
    .where(inArray(attempt.competitionId, competitionIds))
    .orderBy(
      desc(attempt.recordedAt),
      desc(attempt.createdAt),
      asc(attempt.id),
    );
}

/** Matches as the series standings read them: each side by Team or Participant id. */
function matchFactsOf(matches: LoadedMatch[]): ResultFact[] {
  return matches.map((m) => ({
    id: m.id,
    recordedAt: m.recordedAt,
    players: m.players.map((p) => ({
      id: idOf(p),
      place: p.place,
      score: p.score,
    })),
  }));
}

/** Whether a series' Best of is decided (`bestOfWinner`), and by whom. */
function decidedOf(found: LoggedCompetition, matches: LoadedMatch[]) {
  const winnerId =
    found.format === "head-to-head"
      ? bestOfWinner(found.config as SeriesConfig, matchFactsOf(matches))
      : null;
  return { decided: winnerId !== null, winnerId };
}

/** Entrant rows as Match sides, without their ids. */
const sidesOf = (entrants: MatchSide[]): MatchSide[] =>
  entrants.map(({ teamId, participantId }) => ({ teamId, participantId }));

/** A series' facet with no posted players and no Match. */
function seriesFacetOf(
  found: LoggedCompetition,
  runs: boolean,
  linked: Linked,
  entrants: MatchSide[],
  matches: LoadedMatch[],
): SeriesLogFacet {
  return {
    runs,
    closed: found.closed,
    selfReport: found.selfReport,
    decided: decidedOf(found, matches).decided,
    played: matches.length,
    bestOf: (found.config as SeriesConfig).bestOf,
    linked,
    scoring: found.scoring,
    entrants: sidesOf(entrants),
    players: [],
    match: null,
  };
}

export type SeriesLogFacts = {
  /** What `can("series.log" | "series.edit" | "series.delete", …)` checks. */
  seriesLog: SeriesLogFacet;
  linked: Linked;
  competition: LoggedCompetition;
  /** The two sides as Entrant rows, for the write. */
  entrants: (MatchSide & { id: string })[];
};

/**
 * The facts a Head-to-head Match write is checked against (ADR 0011):
 * whether `email` runs this Competition (read in `dbOrTx`), whether it's
 * closed or decided, the linked Participant, its Entrants, the posted
 * players (`playerIds`, Teams or Participants by scoring; none for a
 * delete) and, for an edit or delete, the Match loaded by its id within
 * this Competition. Null when the Competition isn't a Head-to-head.
 */
export async function getSeriesLogFacts(
  competitionId: string,
  matchId: string | null,
  email: string | null | undefined,
  playerIds: string[],
  dbOrTx: DBOrTx = db,
): Promise<SeriesLogFacts | null> {
  const found = await getLoggedCompetition(competitionId, dbOrTx);
  if (!found || found.format !== "head-to-head") return null;
  const normalized = normalizedEmail(email);
  const [runs, linked, entrants, matches] = await Promise.all([
    runsCompetition(competitionId, normalized, dbOrTx),
    linkedIn(found.warWeekId, normalized, dbOrTx),
    entrantsOf([competitionId], dbOrTx),
    matchesOf([competitionId], dbOrTx),
  ]);
  const loaded = matchId ? matches.find((m) => m.id === matchId) : undefined;
  return {
    seriesLog: {
      ...seriesFacetOf(found, runs, linked, entrants, matches),
      players: playerIds.map((id) => sideOf(found.scoring, id)),
      match:
        matchId === null
          ? null
          : loaded
            ? { players: sidesOf(loaded.players) }
            : "missing",
    },
    linked,
    competition: found,
    entrants: entrants.map(({ id, teamId, participantId }) => ({
      id,
      teamId,
      participantId,
    })),
  };
}

export type AttemptLogFacts = {
  /** What `can("attempts.log" | "attempts.edit" | "attempts.delete", …)` checks. */
  attemptLog: AttemptLogFacet;
  linked: Linked;
  competition: LoggedCompetition;
  /** The posted Participant's Attempts, newest first (a save at a limit of 1 edits the first). */
  postedAttemptIds: string[];
};

/**
 * The facts a Best score Attempt write is checked against (ADR 0011):
 * whether `email` runs this Competition, whether it's closed, the linked
 * Participant, the posted Participant (null for a delete) and, for an
 * edit or delete, the Attempt loaded by its id within this Competition.
 * Null when the Competition isn't Best score.
 */
export async function getAttemptLogFacts(
  competitionId: string,
  attemptId: string | null,
  email: string | null | undefined,
  participantId: string | null,
  dbOrTx: DBOrTx = db,
): Promise<AttemptLogFacts | null> {
  const found = await getLoggedCompetition(competitionId, dbOrTx);
  if (!found || found.format !== "best-score") return null;
  const normalized = normalizedEmail(email);
  const [runs, linked, loaded, posted] = await Promise.all([
    runsCompetition(competitionId, normalized, dbOrTx),
    linkedIn(found.warWeekId, normalized, dbOrTx),
    attemptId && isUuid(attemptId)
      ? dbOrTx
          .select({ participantId: attempt.participantId })
          .from(attempt)
          .where(
            and(
              eq(attempt.id, attemptId),
              eq(attempt.competitionId, competitionId),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
    participantId && isUuid(participantId)
      ? dbOrTx
          .select({ id: attempt.id })
          .from(attempt)
          .where(
            and(
              eq(attempt.competitionId, competitionId),
              eq(attempt.participantId, participantId),
            ),
          )
          .orderBy(
            desc(attempt.recordedAt),
            desc(attempt.createdAt),
            asc(attempt.id),
          )
      : Promise.resolve([]),
  ]);
  return {
    attemptLog: {
      runs,
      closed: found.closed,
      selfReport: found.selfReport,
      linked,
      scoring: found.scoring,
      participantId,
      attempt: attemptId === null ? null : (loaded[0] ?? "missing"),
      maxAttempts: found.maxAttempts,
      attemptsSoFar: posted.length,
    },
    linked,
    competition: found,
    postedAttemptIds: posted.map((row) => row.id),
  };
}

/** The standings of a loaded Competition. */
function standingsOf(
  found: LoggedCompetition,
  entrants: MatchSide[],
  matches: LoadedMatch[],
  attempts: LoadedAttempt[],
): StandingsRow[] {
  if (found.format === "head-to-head") {
    return rankSeries(
      found.config as SeriesConfig,
      matchFactsOf(matches),
      entrants.map(idOf),
    );
  }
  return rankAttempts(
    found.config as BestScoreSettings,
    found.scoring,
    attempts,
  );
}

/**
 * A Head-to-head or Best score Competition's standings: Head-to-head's two
 * Entrants by Matches won (`rankSeries`); Best score by its Attempts
 * (`rankAttempts`). Empty when the Competition is gone or another Format.
 */
export async function getLoggedStandings(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<StandingsRow[]> {
  const found = await getLoggedCompetition(competitionId, dbOrTx);
  if (!found) return [];
  const [entrants, matches, attempts] = await Promise.all([
    entrantsOf([competitionId], dbOrTx),
    matchesOf([competitionId], dbOrTx),
    attemptsOf([competitionId], dbOrTx),
  ]);
  return standingsOf(found, entrants, matches, attempts);
}

/** A Team or Participant as a Head-to-head or Best score page shows it: name and Team color. */
export type LoggedResultsName = {
  id: string;
  name: string;
  color: string | null;
};

/** A result form's choice of player: the name and Team color, plus what its picker shows. */
export type LoggedResultsPlayerOption = LoggedResultsName & {
  /** A Participant's picture URL; null or absent for initials. */
  image?: string | null;
  /** A Participant's Team name; null or absent for none. Never an email. */
  teamName?: string | null;
};

export type LoggedResultsRow = StandingsRow & {
  name: string;
  color: string | null;
  /** A Participant's Team name, for the Team rule; null or absent for none. */
  teamName?: string | null;
  /** A Participant's picture URL; null for initials and for Teams. */
  image?: string | null;
  /**
   * War Week points for the row (spec R20, decision 2): while open, the
   * Provisional points Close would award (`pointsFor` on the standings'
   * placings, the rule Close runs); once Closed, what its generated Points
   * Entries add up to. Null when it earns none.
   */
  points: number | null;
};

export type LoggedResultsPlayer = LoggedResultsName & {
  image?: string | null;
  place: number | null;
  score: number | null;
};

/** One logged Match or Attempt, for one viewer. */
export type LoggedResultView = {
  id: string;
  recordedAt: Date;
  /**
   * A Match's two sides (Teams or Participants by scoring), or an
   * Attempt's one Participant.
   */
  players: LoggedResultsPlayer[];
  /**
   * The standings row an Attempt counts for (its Participant, or the Team
   * it was credited to); null for a Match.
   */
  creditedTo: string | null;
  /** Whether the viewer may edit or delete it. */
  canEdit: boolean;
  canDelete: boolean;
};

/**
 * Everything a Head-to-head or Best score Competition's page shows, for
 * one viewer. Names, ids and booleans only: no email is ever selected (R3
 * decision 17).
 */
export type LogOffer = {
  label: string;
  disabledReason: string | null;
  attemptsLeft: number | null;
};

export type LoggedResultsView = {
  competition: LoggedCompetition;
  /** Ranked best first; a row with no result is unranked, last. */
  leaderboard: LoggedResultsRow[];
  /** Newest first. */
  results: LoggedResultView[];
  /** The viewer's linked Participant and Team, for the "Mine" filter. */
  linked: Linked;
  /** The viewer is an Organizer or a Host of this Competition. */
  runs: boolean;
  /** Whether the viewer may log a Match or Attempt right now (a Log button). */
  viewerCanLog: boolean;
  /**
   * The viewer's Log button, or null for none: its label ("Log a Match",
   * "Log an Attempt" or "Update your score"), the reason it's disabled
   * (a decided or drawn series, no Attempts left), and the viewer's own
   * Attempts left.
   */
  logOffer: LogOffer | null;
  /** Best score: each Participant's Attempts so far, by id (the form's "N attempts left"). */
  attemptCounts: Record<string, number>;
  /** A Head-to-head series won by a majority of its Best of. */
  decided: boolean;
  /** The decided series' Winner's name, or null. */
  seriesWinner: string | null;
  /**
   * Who the result form offers: a Head-to-head's two Entrants, or every
   * Participant of the War Week for Best score.
   */
  playerOptions: LoggedResultsPlayerOption[];
};

/**
 * A Head-to-head or Best score Competition's standings, results and form
 * options for `viewerEmail` (null when anonymous), with
 * `canEdit`/`canDelete` per result computed here. Null when the
 * Competition is gone or another Format.
 */
export async function getLoggedResultsView(
  competitionId: string,
  viewerEmail: string | null,
  dbOrTx: DBOrTx = db,
): Promise<LoggedResultsView | null> {
  const found = await getLoggedCompetition(competitionId, dbOrTx);
  if (!found) return null;
  const email = normalizedEmail(viewerEmail);
  const [runs, linked, entrants, matches, attempts, teams, participants] =
    await Promise.all([
      runsCompetition(competitionId, email, dbOrTx),
      linkedIn(found.warWeekId, email, dbOrTx),
      entrantsOf([competitionId], dbOrTx),
      matchesOf([competitionId], dbOrTx),
      attemptsOf([competitionId], dbOrTx),
      dbOrTx
        .select({ id: team.id, name: team.name, color: team.color })
        .from(team)
        .where(eq(team.warWeekId, found.warWeekId))
        .orderBy(asc(team.name)),
      withProfile(
        dbOrTx
          .select({
            id: participant.id,
            name: participantNameSql(),
            image: participantImageSql(),
            teamId: participant.teamId,
          })
          .from(participant)
          .$dynamic(),
      )
        .where(eq(participant.warWeekId, found.warWeekId))
        .orderBy(asc(participantNameSql())),
    ]);
  const entryPoints = found.closed
    ? await getCompetitionEntryPoints(competitionId, dbOrTx)
    : [];

  const colorOfTeam = new Map(teams.map((t) => [t.id, t.color]));
  const nameOfTeam = new Map(teams.map((t) => [t.id, t.name]));
  const names = new Map<
    string,
    LoggedResultsName & { image: string | null; teamName: string | null }
  >();
  for (const t of teams) names.set(t.id, { ...t, image: null, teamName: null });
  for (const p of participants) {
    names.set(p.id, {
      id: p.id,
      name: p.name,
      image: p.image,
      color: p.teamId ? (colorOfTeam.get(p.teamId) ?? null) : null,
      teamName: p.teamId ? (nameOfTeam.get(p.teamId) ?? null) : null,
    });
  }
  const nameOf = (id: string) =>
    names.get(id) ?? {
      id,
      name: "Unknown",
      color: null,
      image: null,
      teamName: null,
    };

  const rows = standingsOf(found, entrants, matches, attempts);
  const provisional = new Map(
    pointsFor(placingsOf(rows), found).map((p) => [p.entrantId, p.points]),
  );
  const pointsOf = (id: string) =>
    found.closed
      ? entryPointsFor(entryPoints, sideOf(found.scoring, id))
      : (provisional.get(id) ?? null);
  const leaderboard = rows.map((row) => {
    const { name, color, image, teamName } = nameOf(row.id);
    return { ...row, name, color, image, teamName, points: pointsOf(row.id) };
  });
  const { decided, winnerId } = decidedOf(found, matches);
  const seriesWinner = winnerId ? nameOf(winnerId).name : null;

  if (found.format === "head-to-head") {
    const facet = seriesFacetOf(found, runs, linked, entrants, matches);
    const offer = seriesLogOffer(facet);
    return {
      competition: found,
      leaderboard,
      results: matches.map((m) => {
        const allowed =
          seriesChangeError({
            ...facet,
            match: { players: sidesOf(m.players) },
          }) === null;
        return {
          id: m.id,
          recordedAt: m.recordedAt,
          players: m.players.map((p) => ({
            ...nameOf(idOf(p)),
            place: p.place,
            score: p.score,
          })),
          creditedTo: null,
          canEdit: allowed,
          canDelete: allowed,
        };
      }),
      linked,
      runs,
      viewerCanLog: offer !== null && offer.disabledReason === null,
      logOffer: offer && {
        label: "Log a Match",
        disabledReason: offer.disabledReason,
        attemptsLeft: null,
      },
      attemptCounts: {},
      decided,
      seriesWinner,
      playerOptions: entrants.map((e) => {
        const { id, name, color, image, teamName } = nameOf(idOf(e));
        return { id, name, color, image, teamName };
      }),
    };
  }

  const attemptCounts: Record<string, number> = {};
  for (const a of attempts) {
    attemptCounts[a.participantId] = (attemptCounts[a.participantId] ?? 0) + 1;
  }
  const facet: AttemptLogFacet = {
    runs,
    closed: found.closed,
    selfReport: found.selfReport,
    linked,
    scoring: found.scoring,
    participantId: null,
    attempt: null,
    maxAttempts: found.maxAttempts,
    attemptsSoFar: linked ? (attemptCounts[linked.participantId] ?? 0) : 0,
  };
  const offer = attemptLogOffer(facet);
  return {
    competition: found,
    leaderboard,
    results: attempts.map((a) => {
      const allowed =
        attemptChangeError({
          ...facet,
          attempt: { participantId: a.participantId },
        }) === null;
      return {
        id: a.id,
        recordedAt: a.recordedAt,
        players: [{ ...nameOf(a.participantId), place: null, score: a.score }],
        creditedTo: rowIdOf(found.scoring, a),
        canEdit: allowed,
        canDelete: allowed,
      };
    }),
    linked,
    runs,
    viewerCanLog: offer !== null && offer.disabledReason === null,
    logOffer: offer,
    attemptCounts,
    decided: false,
    seriesWinner: null,
    playerOptions: participants.map((p) => {
      const { id, name, color, image, teamName } = nameOf(p.id);
      return { id, name, color, image, teamName };
    }),
  };
}

export type LoggableCompetition = {
  id: string;
  name: string;
  format: LoggedFormat;
};

/**
 * The open Head-to-head and Best score Competitions of a War Week where
 * the Participant linked to `email` may log a Match or Attempt right now:
 * not closed, self-report on, for a Head-to-head a series still open that
 * they (or their Team) play in, for Best score with Attempts left. Empty with no link. For the home page's "Log a result"
 * card; ordered by name.
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
          inArray(competition.format, [...LOGGED_FORMATS]),
          isNull(competition.closedAt),
        ),
      )
  ).map((c) => c.id);
  const [found, entrants, matches, attempts] = await Promise.all([
    loadCompetitions(ids, dbOrTx),
    entrantsOf(ids, dbOrTx),
    matchesOf(ids, dbOrTx),
    attemptsOf(ids, dbOrTx),
  ]);
  return found.flatMap((c) => {
    const offer =
      c.format === "head-to-head"
        ? seriesLogOffer(
            seriesFacetOf(
              c,
              false,
              linked,
              entrants.filter((e) => e.competitionId === c.id),
              matches.filter((m) => m.competitionId === c.id),
            ),
          )
        : attemptLogOffer({
            runs: false,
            closed: c.closed,
            selfReport: c.selfReport,
            linked,
            scoring: c.scoring,
            participantId: null,
            attempt: null,
            maxAttempts: c.maxAttempts,
            attemptsSoFar: attempts.filter(
              (a) =>
                a.competitionId === c.id &&
                a.participantId === linked.participantId,
            ).length,
          });
    return offer && offer.disabledReason === null
      ? [{ id: c.id, name: c.name, format: c.format }]
      : [];
  });
}
