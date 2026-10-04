/**
 * A Best score Competition's standings (CONTEXT.md; spec R21, decision
 * 13): individual, a person's best Attempt; team, by its Team score: Best
 * member (the Team's single best Attempt) or Sum of members (each member's
 * best Attempt, added up). Pure: no database, no framework.
 */
import type { BestScoreSettings } from "@/lib/best-score/config";
import {
  type StandingsRow,
  emptyRow,
  formatScore,
  rankRows,
} from "@/lib/logged-results";

type Scoring = "team" | "individual";

/**
 * One Attempt: a Participant's Score, and the Team it counts for (the
 * Participant's Team when it was logged; null when they had none).
 */
export type AttemptFact = {
  id: string;
  recordedAt: Date;
  participantId: string;
  teamId: string | null;
  score: number;
};

type Ranking = Pick<BestScoreSettings, "betterIs" | "teamScore">;

/**
 * The standings row an Attempt counts for: its Participant (individual) or
 * its Team (team); null for a team Attempt on no Team, which counts for
 * nobody.
 */
export function rowIdOf(scoring: Scoring, attempt: AttemptFact): string | null {
  return scoring === "team" ? attempt.teamId : attempt.participantId;
}

/** Whether `a` beats `b` by the direction (never a tie: equal is not better). */
const beats = (betterIs: Ranking["betterIs"], a: number, b: number) =>
  betterIs === "higher" ? a > b : a < b;

/** Whether this Competition ranks by Sum of members. */
export function sumsMembers(scoring: Scoring, settings: Ranking): boolean {
  return scoring === "team" && settings.teamScore === "sum-of-members";
}

/**
 * Ranks the Attempts into standings: one row per Participant (individual)
 * or Team (team) with an Attempt, best first by the direction; ties share
 * the higher rank. `best` holds a row's counted Attempt, or `total` its Sum
 * of members.
 */
export function rankAttempts(
  settings: Ranking,
  scoring: Scoring,
  attempts: AttemptFact[],
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  const memberBest = new Map<string, Map<string, number>>();
  for (const attempt of attempts) {
    const id = rowIdOf(scoring, attempt);
    if (id === null) continue;
    const row = rows.get(id) ?? emptyRow(id);
    rows.set(id, row);
    row.played += 1;
    if (
      row.best === null ||
      beats(settings.betterIs, attempt.score, row.best)
    ) {
      row.best = attempt.score;
    }
    const members = memberBest.get(id) ?? new Map<string, number>();
    memberBest.set(id, members);
    const mine = members.get(attempt.participantId);
    if (mine === undefined || beats(settings.betterIs, attempt.score, mine)) {
      members.set(attempt.participantId, attempt.score);
    }
  }
  const sum = sumsMembers(scoring, settings);
  for (const row of rows.values()) {
    if (!sum) continue;
    row.total = [...(memberBest.get(row.id)?.values() ?? [])].reduce(
      (a, b) => a + b,
      0,
    );
    row.best = null;
  }
  return rankRows(
    [...rows.values()],
    (row) => (sum ? row.total : row.best),
    settings.betterIs === "lower" ? "asc" : "desc",
  );
}

/** A standings row's Attempts, by id. */
export type RowAttempts = {
  /** The Attempt the row's Score comes from; null under Sum of members. */
  best: string | null;
  /** Every Attempt of the row, newest first. */
  attempts: string[];
};

/**
 * Each standings row's Attempts (spec R20, decision 4): the one its Score
 * comes from (a tie: the earlier) and all of them newest first, so a row
 * can list "2 more attempts" (or, under Sum of members, every Attempt).
 */
export function attemptsOf(
  settings: Ranking,
  scoring: Scoring,
  attempts: AttemptFact[],
): Map<string, RowAttempts> {
  const byRow = new Map<string, AttemptFact[]>();
  for (const attempt of attempts) {
    const id = rowIdOf(scoring, attempt);
    if (id === null) continue;
    byRow.set(id, [...(byRow.get(id) ?? []), attempt]);
  }
  const better = (a: AttemptFact, b: AttemptFact) =>
    a.score !== b.score
      ? beats(settings.betterIs, a.score, b.score)
      : a.recordedAt.getTime() !== b.recordedAt.getTime()
        ? a.recordedAt.getTime() < b.recordedAt.getTime()
        : a.id < b.id;
  const sum = sumsMembers(scoring, settings);
  const result = new Map<string, RowAttempts>();
  for (const [id, list] of byRow) {
    const best = list.reduce((top, next) => (better(next, top) ? next : top));
    const newestFirst = [...list].sort(
      (a, b) =>
        b.recordedAt.getTime() - a.recordedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    result.set(id, {
      best: sum ? null : best.id,
      attempts: newestFirst.map((a) => a.id),
    });
  }
  return result;
}

/**
 * A row's expand toggle (spec R20, decision 4): the other Attempts besides
 * the counted one ("2 more attempts"), or every Attempt ("3 attempts").
 */
export function attemptsLabel(count: number, mode: "more" | "all"): string {
  const noun = count === 1 ? "attempt" : "attempts";
  return mode === "more" ? `${count} more ${noun}` : `${count} ${noun}`;
}

/** One line of an Attempt's copy: "Ashley · 42 trips". */
export function attemptSummary(
  name: string,
  score: number | null,
  unit: string,
): string {
  return `${name} · ${formatScore(score, unit)}`;
}
