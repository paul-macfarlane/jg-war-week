/**
 * What Close turns a Competition's results into (spec R21, decision 1):
 * each Format's pure "placings now" function, from its current results to
 * the Points a Close writes, or the reason it can't close yet. One Close
 * mutation (`src/mutations/close.ts`) runs whichever the Format needs, so
 * every Format closes the same way and only this step differs. Pure.
 */
import type { Competition } from "@/db/schema";
import { finalPlacings, isComplete } from "@/lib/bracket/formats";
import { pointsFor } from "@/lib/bracket/points";
import type { Bracket, Entrant } from "@/lib/bracket/types";
import type { LeagueConfig } from "@/lib/league/config";
import type { LeagueMatchFacts } from "@/lib/league/pairing";
import { unplayedSummary } from "@/lib/league/rules";
import { leaguePlacings, leagueStandings } from "@/lib/league/standings";
import {
  type ResultFact,
  type StandingsRow,
  placingsOf,
} from "@/lib/logged-results";
import { scoreParticipation } from "@/lib/participation/score";
import type { TookPart } from "@/lib/participation/score";
import {
  closePlacementError,
  placementPointsByRow,
} from "@/lib/placement/score";
import type { SeriesConfig } from "@/lib/series/config";
import { bestOfWinner, rankSeries, seriesDrawn } from "@/lib/series/standings";

/** Close's refusal for a Bracket with Matches still to play. */
export const FINISH_EVERY_MATCH = "Finish every Match before closing.";
/**
 * Close's refusal for a Head-to-head series neither decided nor drawn
 * (execution plan, [SCOPE CHANGE]; Paul, Q3).
 */
export const FINISH_THE_SERIES = "Finish the series before closing.";

/** One Points Entry a Close writes: to a Team or to a Participant. */
export type GeneratedPoints = {
  teamId: string | null;
  participantId: string | null;
  points: number;
};

/** The Points a Close writes now, or why it can't close. */
export type PlacingsNow =
  { ok: true; points: GeneratedPoints[] } | { ok: false; error: string };

type PointsRules = Pick<Competition, "placementPoints">;

/**
 * A Placement sheet: each placed row's Place's Placement Points. Refused
 * while a row has a Score and no Place, or nobody is placed.
 */
export function placementPlacingsNow(
  rows: {
    id: string;
    name: string;
    teamId: string | null;
    participantId: string | null;
    place: number | null;
    score: number | null;
  }[],
  rules: PointsRules,
): PlacingsNow {
  const error = closePlacementError(rows);
  if (error) return { ok: false, error };
  const byId = new Map(rows.map((row) => [row.id, row]));
  return {
    ok: true,
    points: placementPointsByRow(rows, rules).map(({ id, points }) => ({
      teamId: byId.get(id)!.teamId,
      participantId: byId.get(id)!.participantId,
      points,
    })),
  };
}

/**
 * A Bracket: the final placings' Placement Points, once every Match is
 * played. An Entrant's points go to its Team (a Squad's Team's) or its
 * Participant.
 */
export function bracketPlacingsNow(
  bracket: Bracket,
  entrants: (Entrant & {
    pointsTeamId: string | null;
    participantId: string | null;
  })[],
  rules: PointsRules,
): PlacingsNow {
  if (!isComplete(bracket)) return { ok: false, error: FINISH_EVERY_MATCH };
  const byId = new Map(entrants.map((e) => [e.id, e]));
  return {
    ok: true,
    points: pointsFor(finalPlacings(bracket, entrants), rules).map(
      ({ entrantId, points }) => ({
        teamId: byId.get(entrantId)!.pointsTeamId,
        participantId: byId.get(entrantId)!.participantId,
        points,
      }),
    ),
  };
}

/**
 * A Head-to-head or Best score Competition: its standings' ranks (ties
 * sharing a place's points) to the Team or Participant by scoring.
 */
export function loggedPlacingsNow(
  rows: StandingsRow[],
  rules: PointsRules & Pick<Competition, "scoring">,
): PlacingsNow {
  return {
    ok: true,
    points: pointsFor(placingsOf(rows), rules).map(({ entrantId, points }) => ({
      teamId: rules.scoring === "team" ? entrantId : null,
      participantId: rules.scoring === "team" ? null : entrantId,
      points,
    })),
  };
}

/**
 * Why a Head-to-head series can't close yet, or null: it closes once it is
 * decided (a majority of the Best of, `bestOfWinner`) or drawn (every
 * Match played with no majority, `seriesDrawn`). The page disables Close
 * with the same reason.
 */
export function seriesCloseError(
  config: SeriesConfig,
  matches: ResultFact[],
): string | null {
  return bestOfWinner(config, matches) !== null || seriesDrawn(config, matches)
    ? null
    : FINISH_THE_SERIES;
}

/**
 * A Head-to-head series: refused until decided or drawn
 * (`seriesCloseError`), then its standings' ranks to the Team or
 * Participant by scoring (a drawn series ranks both 1st).
 */
export function seriesPlacingsNow(
  series: {
    config: SeriesConfig;
    matches: ResultFact[];
    /** The two Entrants, by Team or Participant id. */
    entrantIds: string[];
  },
  rules: PointsRules & Pick<Competition, "scoring">,
): PlacingsNow {
  const error = seriesCloseError(series.config, series.matches);
  if (error) return { ok: false, error };
  return loggedPlacingsNow(
    rankSeries(series.config, series.matches, series.entrantIds),
    rules,
  );
}

/**
 * A League (spec R23, decision 9; reading R10): refused until complete,
 * naming the unplayed Matches and unpaired rounds (`unplayedSummary`);
 * then each Entrant's standing's Placement Points, tied Entrants sharing a
 * place's full points, to its Team or Participant.
 */
export function leaguePlacingsNow(
  league: {
    config: LeagueConfig;
    entrants: {
      id: string;
      name: string;
      teamId: string | null;
      participantId: string | null;
    }[];
    matches: LeagueMatchFacts[];
  },
  rules: PointsRules,
): PlacingsNow {
  const byId = new Map(league.entrants.map((e) => [e.id, e]));
  const error = unplayedSummary({
    config: league.config,
    entrantCount: league.entrants.length,
    matches: league.matches,
    nameOf: (id) => byId.get(id)?.name ?? "Unknown",
  });
  if (error) return { ok: false, error };
  const rows = leagueStandings(
    league.config.pairing,
    league.entrants.map((e) => e.id),
    league.matches,
  );
  return {
    ok: true,
    points: pointsFor(leaguePlacings(rows), rules).map(
      ({ entrantId, points }) => ({
        teamId: byId.get(entrantId)!.teamId,
        participantId: byId.get(entrantId)!.participantId,
        points,
      }),
    ),
  };
}

/** A Participation Competition: who took part (`scoreParticipation`). */
export function participationPlacingsNow(
  tookPart: TookPart[],
  rules: Pick<
    Competition,
    "scoring" | "placementPoints" | "participationPoints"
  >,
): PlacingsNow {
  return { ok: true, points: scoreParticipation(tookPart, rules) };
}
