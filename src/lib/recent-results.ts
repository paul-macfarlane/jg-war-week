import type { Competition } from "@/db/schema";

/** Home shows at most this many Recent results rows. */
export const RECENT_RESULTS_LIMIT = 5;

/**
 * Points Entries of one Competition belong to one row when each is added
 * within this many milliseconds of the previous one (10 minutes).
 */
export const RECENT_RESULTS_GROUP_GAP_MS = 10 * 60 * 1000;

/** Who a Points Entry or result is for: a Team, or a Participant. */
export type ResultTarget = {
  /** The Team's or Participant's id: two of one name are still two. */
  id: string;
  name: string;
  /** A Participant's picture URL; null for initials and for Teams. */
  image?: string | null;
  /** The Team's color, or the Participant's Team's color; null without one. */
  color: string | null;
  kind: "team" | "participant";
};

export type ResultCompetition = Pick<
  Competition,
  "id" | "name" | "format" | "finalizedAt"
>;

export type ResultEntry = {
  id: string;
  competitionId: string;
  points: number;
  enteredAt: Date;
  /** Written by finalizing a Bracket or closing a `games` Competition. */
  generatedByBracket: boolean;
  target: ResultTarget;
};

export type RecentResult =
  | {
      kind: "bracket-finalized" | "games-closed";
      key: string;
      competitionId: string;
      competition: string;
      when: Date;
      /** The champion / winner; more than one on a tie for first. */
      winners: ResultTarget[];
    }
  | {
      kind: "points";
      key: string;
      competitionId: string;
      competition: string;
      when: Date;
      /** One per target, highest points first. */
      scores: { target: ResultTarget; points: number }[];
    };

/**
 * Shapes a War Week's Recent results, newest first, at most
 * `RECENT_RESULTS_LIMIT` rows:
 *
 * - A finalized Bracket (`single-elimination` / `heats`) is one
 *   "bracket-finalized" row and a closed `games` Competition one
 *   "games-closed" row, both at `finalizedAt`. The champion or winner is the
 *   target of the highest generated Points Entry (the 1st-place entry its
 *   finalize or close wrote); a tie for first lists every target.
 * - The generated entries themselves are not rows of their own.
 * - Manual Points Entries of one Competition added "together" collapse into
 *   one "points" row. Together means chained by time: sorted by `enteredAt`,
 *   an entry joins the previous entry's group when it was added within
 *   `RECENT_RESULTS_GROUP_GAP_MS` of it; a longer gap starts a new group.
 *   The row's time is its newest entry. Entries for one target add up.
 * - Competitions without a finalize time and entries of unknown Competitions
 *   contribute nothing; a `points`-Format Competition never has a finalize
 *   row.
 */
export function shapeRecentResults(
  competitions: ResultCompetition[],
  entries: ResultEntry[],
): RecentResult[] {
  const byId = new Map(competitions.map((c) => [c.id, c]));
  const results: RecentResult[] = [];

  for (const c of competitions) {
    if (!c.finalizedAt || c.format === "points") continue;
    const generated = entries.filter(
      (e) => e.competitionId === c.id && e.generatedByBracket,
    );
    const top = Math.max(...generated.map((e) => e.points));
    const winners: ResultTarget[] = [];
    for (const e of generated) {
      if (e.points === top && !winners.some((w) => sameTarget(w, e.target))) {
        winners.push(e.target);
      }
    }
    if (winners.length === 0) continue;
    results.push({
      kind: c.format === "games" ? "games-closed" : "bracket-finalized",
      key: `final-${c.id}`,
      competitionId: c.id,
      competition: c.name,
      when: c.finalizedAt,
      winners,
    });
  }

  const manual = entries
    .filter((e) => !e.generatedByBracket && byId.has(e.competitionId))
    .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
  const groups: ResultEntry[][] = [];
  const open = new Map<string, ResultEntry[]>();
  for (const e of manual) {
    const group = open.get(e.competitionId);
    const last = group?.[group.length - 1];
    if (
      group &&
      last &&
      e.enteredAt.getTime() - last.enteredAt.getTime() <=
        RECENT_RESULTS_GROUP_GAP_MS
    ) {
      group.push(e);
    } else {
      const fresh = [e];
      open.set(e.competitionId, fresh);
      groups.push(fresh);
    }
  }
  for (const group of groups) {
    const competition = byId.get(group[0].competitionId);
    if (!competition) continue;
    const scores: { target: ResultTarget; points: number }[] = [];
    for (const e of group) {
      const existing = scores.find((s) => sameTarget(s.target, e.target));
      if (existing) existing.points += e.points;
      else scores.push({ target: e.target, points: e.points });
    }
    scores.sort(
      (a, b) =>
        b.points - a.points || a.target.name.localeCompare(b.target.name),
    );
    results.push({
      kind: "points",
      key: `points-${group[0].id}`,
      competitionId: competition.id,
      competition: competition.name,
      when: group[group.length - 1].enteredAt,
      scores,
    });
  }

  return results
    .sort(
      (a, b) =>
        b.when.getTime() - a.when.getTime() || a.key.localeCompare(b.key),
    )
    .slice(0, RECENT_RESULTS_LIMIT);
}

function sameTarget(a: ResultTarget, b: ResultTarget): boolean {
  return a.kind === b.kind && a.id === b.id;
}
