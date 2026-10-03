import type { Competition } from "@/db/schema";
import { isGameFormat } from "@/lib/enums";

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
  /** Null for Discretionary points, which belong to no Competition. */
  competitionId: string | null;
  points: number;
  /** A Discretionary entry's reason; a Competition entry's note. */
  note?: string | null;
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
      kind: "participation-closed";
      key: string;
      competitionId: string;
      competition: string;
      when: Date;
      /** Team scoring: the top Team; more than one on a tie. Else empty. */
      winners: ResultTarget[];
      /** Individual scoring: how many took part. Null in team scoring. */
      tookPart: number | null;
    }
  | {
      /** Discretionary points: one row per entry, with its reason. */
      kind: "discretionary";
      key: string;
      when: Date;
      target: ResultTarget;
      points: number;
      reason: string;
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
 * - A closed `participation` Competition is one "participation-closed" row
 *   at `finalizedAt`: in team scoring its top Team (as above), in
 *   individual scoring how many took part (one generated entry each).
 * - The generated entries themselves are not rows of their own.
 * - Each Discretionary entry (no Competition) is a "discretionary" row of
 *   its own at `enteredAt`, with its reason.
 * - Manual Points Entries of one Competition added "together" collapse into
 *   one "points" row. Together means chained by time: sorted by `enteredAt`,
 *   an entry joins the previous entry's group when it was added within
 *   `RECENT_RESULTS_GROUP_GAP_MS` of it; a longer gap starts a new group.
 *   The row's time is its newest entry. Entries for one target add up.
 * - Competitions without a finalize time and entries of unknown Competitions
 *   contribute nothing; a `placement`-Format Competition never has a finalize
 *   row.
 */
export function shapeRecentResults(
  competitions: ResultCompetition[],
  entries: ResultEntry[],
): RecentResult[] {
  const byId = new Map(competitions.map((c) => [c.id, c]));
  const results: RecentResult[] = [];

  for (const final of finalWinners(competitions, entries)) {
    const c = final.competition;
    const base = {
      key: `final-${c.id}`,
      competitionId: c.id,
      competition: c.name,
      when: c.finalizedAt,
    };
    if (c.format === "participation") {
      results.push({
        kind: "participation-closed",
        ...base,
        winners: final.winners,
        tookPart: final.tookPart,
      });
      continue;
    }
    results.push({
      kind: isGameFormat(c.format) ? "games-closed" : "bracket-finalized",
      ...base,
      winners: final.winners,
    });
  }

  for (const e of entries) {
    if (e.competitionId !== null || e.generatedByBracket) continue;
    results.push({
      kind: "discretionary",
      key: `discretionary-${e.id}`,
      when: e.enteredAt,
      target: e.target,
      points: e.points,
      reason: e.note ?? "",
    });
  }

  const manual = entries
    .filter(
      (e) =>
        !e.generatedByBracket &&
        e.competitionId !== null &&
        byId.has(e.competitionId),
    )
    .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
  const groups: ResultEntry[][] = [];
  const open = new Map<string, ResultEntry[]>();
  for (const e of manual) {
    const group = open.get(e.competitionId!);
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
      open.set(e.competitionId!, fresh);
      groups.push(fresh);
    }
  }
  for (const group of groups) {
    const competition = byId.get(group[0].competitionId!);
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

/** A finalized Competition's result, as its finalize or close wrote it. */
export type FinalWinners = {
  competition: ResultCompetition & { finalizedAt: Date };
  /**
   * The champion or winner: the target of the highest generated Points
   * Entry; more than one on a tie for first. Empty for an
   * individual-scoring Participation Competition, which has no winner.
   */
  winners: ResultTarget[];
  /** Individual-scoring Participation: how many took part. Else null. */
  tookPart: number | null;
};

/**
 * The winner of each finalized Bracket, closed `games` Competition and
 * closed `participation` Competition, in `competitions` order: the one
 * rule Recent results and the Finale's Champions slide share. A
 * Competition with no finalize time, a `placement`-Format one, or one with no
 * generated Points Entries has none and is left out.
 */
export function finalWinners(
  competitions: ResultCompetition[],
  entries: ResultEntry[],
): FinalWinners[] {
  const results: FinalWinners[] = [];
  for (const c of competitions) {
    const finalizedAt = c.finalizedAt;
    if (!finalizedAt || c.format === "placement") continue;
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
    const individual =
      c.format === "participation" &&
      generated.every((e) => e.target.kind !== "team");
    results.push({
      competition: { ...c, finalizedAt },
      winners: individual ? [] : winners,
      tookPart: individual ? generated.length : null,
    });
  }
  return results;
}

function sameTarget(a: ResultTarget, b: ResultTarget): boolean {
  return a.kind === b.kind && a.id === b.id;
}
