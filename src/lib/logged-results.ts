/**
 * What the two Formats whose results are logged one at a time share
 * (CONTEXT.md): a Head-to-head series' Matches and a Best score
 * Competition's Attempts. Their names for people, the standings row both
 * rank into, and small display helpers. Pure: no database, no framework.
 */
import type { Placing } from "@/lib/bracket/types";
import type { LoggedFormat } from "@/lib/enums";

const FORMAT_LABELS: Record<LoggedFormat, string> = {
  "head-to-head": "Head-to-head",
  "best-score": "Best score",
};

export function loggedFormatLabel(format: LoggedFormat): string {
  return FORMAT_LABELS[format];
}

/**
 * What one logged result is called in this Format: a Head-to-head Match or
 * a Best score Attempt (spec competition-results, decision 10).
 */
export function resultNoun(format: LoggedFormat): {
  one: string;
  many: string;
  a: string;
} {
  return format === "best-score"
    ? { one: "Attempt", many: "Attempts", a: "an Attempt" }
    : { one: "Match", many: "Matches", a: "a Match" };
}

/** One logged result's player: a Team or Participant id, its place, its Score. */
export type ResultPlayerFact = {
  id: string;
  place: number | null;
  score: number | null;
};

/** One logged Match or Attempt, as the standings and views read it. */
export type ResultFact = {
  id: string;
  recordedAt: Date;
  players: ResultPlayerFact[];
};

/** One row of a Head-to-head or Best score Competition's standings. */
export type StandingsRow = {
  /** A Team or Participant id. */
  id: string;
  /** Standard competition ranking (1, 1, 3); null with no result yet. */
  rank: number | null;
  played: number;
  /** Head-to-head: Matches won, lost and drawn. */
  wins: number;
  losses: number;
  draws: number;
  /** Best score: the best Attempt that counts (individual, Best member). */
  best: number | null;
  /** Best score Sum of members: each member's best, added up. */
  total: number | null;
};

export function emptyRow(id: string): StandingsRow {
  return {
    id,
    rank: null,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    best: null,
    total: null,
  };
}

/**
 * Ranks rows by `keyOf` (null: unranked, last), best first by `direction`:
 * ties share the higher rank (standard competition ranking), then sort by
 * id so the order is stable.
 */
export function rankRows(
  rows: StandingsRow[],
  keyOf: (row: StandingsRow) => number | null,
  direction: "desc" | "asc",
): StandingsRow[] {
  const ranked = rows.filter((row) => keyOf(row) !== null);
  const unranked = rows
    .filter((row) => keyOf(row) === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  ranked.sort((x, y) => {
    const kx = keyOf(x)!;
    const ky = keyOf(y)!;
    if (kx !== ky) return direction === "desc" ? ky - kx : kx - ky;
    return x.id.localeCompare(y.id);
  });
  let rank = 0;
  let prevKey: number | null = null;
  for (const [i, row] of ranked.entries()) {
    const key = keyOf(row);
    if (key !== prevKey) rank = i + 1;
    row.rank = rank;
    prevKey = key;
  }
  return [...ranked, ...unranked];
}

/**
 * The standings' rows as Placings, the input to `pointsFor`
 * (`src/lib/bracket/points.ts`) so Close awards Placement Points with the
 * Bracket's tie rule. Rows with no rank are omitted.
 */
export function placingsOf(rows: StandingsRow[]): Placing[] {
  return rows.flatMap((row) =>
    row.rank === null ? [] : [{ entrantId: row.id, place: row.rank }],
  );
}

/** A Score with its unit, like "42 trips"; "—" when there is none. */
export function formatScore(score: number | null, unit: string): string {
  if (score === null) return "—";
  return unit ? `${score} ${unit}` : `${score}`;
}

/**
 * Whether the linked Participant (or their Team) is a player of the
 * result, for the "Mine" filter. A player's `id` is a Team or Participant
 * id, never an Entrant row.
 */
export function isMine(
  players: { id: string }[],
  linked: { participantId: string; teamId: string | null },
): boolean {
  return players.some(
    (p) =>
      p.id === linked.participantId ||
      (linked.teamId !== null && p.id === linked.teamId),
  );
}

/**
 * The top places' Placement Points, listed for the Close confirm: "3, 2,
 * 1", or "none set" for a Competition with none.
 */
export function placementPointsList(placementPoints: number[] | null): string {
  return placementPoints && placementPoints.length > 0
    ? placementPoints.join(", ")
    : "none set";
}

/** Logging, or a write, on a Competition of another Format. */
export const NOT_LOGGED_FORMAT =
  "This Competition isn't run as Head-to-head or Best score.";
export const COMPETITION_CLOSED = "This Competition is closed.";
