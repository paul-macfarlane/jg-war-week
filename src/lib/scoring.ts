/**
 * Scoring (CONTEXT.md, Score direction and unit): the one config every
 * Format with Scores shares (Placement, Bracket, Head-to-head, Best score),
 * the "Score (sec)" label, and the Places a direction gives Scores. Pure,
 * so the Placement sheet, Bracket and Head-to-head Matches and Best score
 * standings rank the same way.
 */
import type { ScoreDirection } from "@/lib/enums";

/** Whether a higher or lower Score is better; "none" keeps places by hand. */
export type ScoringConfig = {
  direction: ScoreDirection;
  /** An optional label for the Scores, up to 20 characters. */
  unit: string | null;
};

/** A direction that ranks Scores. */
export type RankingDirection = Exclude<ScoreDirection, "none">;

/** A Competition's scoring config from its columns. */
export function scoringOf(source: {
  scoreDirection: ScoreDirection;
  scoreUnit: string | null;
}): ScoringConfig {
  return {
    direction: source.scoreDirection,
    unit: source.scoreUnit?.trim() ? source.scoreUnit.trim() : null,
  };
}

/** Whether Scores decide places. */
export function ranksByScore(
  direction: ScoreDirection,
): direction is RankingDirection {
  return direction !== "none";
}

/** The Score column's header: "Score (sec)", or "Score" with no unit. */
export function scoreLabel(config: {
  unit: string | null;
  direction?: ScoreDirection;
}): string {
  const unit = config.unit?.trim();
  return unit ? `Score (${unit})` : "Score";
}

/**
 * The Places a direction gives the entries with a Score, by standard
 * competition ranking: equal Scores share a place and the next is skipped
 * (1, 1, 3). An entry without a Score isn't in the map.
 */
export function orderByScore(
  entries: { id: string; score: number | null }[],
  direction: RankingDirection,
): Map<string, number> {
  const scored = entries.filter(
    (entry): entry is { id: string; score: number } => entry.score !== null,
  );
  const better = (a: number, b: number) =>
    direction === "higher" ? a > b : a < b;
  return new Map(
    scored.map((entry) => [
      entry.id,
      scored.filter((other) => better(other.score, entry.score)).length + 1,
    ]),
  );
}

/**
 * Whether the stored places were set by hand: a direction is set, every
 * Score is in, and some place differs from `orderByScore` (which includes
 * a Score tie that was broken). Derived, never stored.
 */
export function isSetByHand(
  entries: { id: string; score: number | null; place: number | null }[],
  direction: ScoreDirection,
): boolean {
  if (!ranksByScore(direction) || entries.length === 0) return false;
  if (entries.some((entry) => entry.score === null)) return false;
  const computed = orderByScore(entries, direction);
  return entries.some((entry) => entry.place !== computed.get(entry.id));
}

/**
 * A Match's finishing order from its Scores (spec R21, decision 7): best
 * first by the direction, once every Entrant has a Score. Equal Scores
 * keep their given order and set `tied`, for the recorder to settle by
 * hand. Null with direction none or a Score missing.
 */
export function finishingOrder(
  entries: { id: string; score: number | null }[],
  direction: ScoreDirection,
): { order: string[]; tied: boolean } | null {
  if (!ranksByScore(direction) || entries.length === 0) return null;
  if (entries.some((entry) => entry.score === null)) return null;
  const places = orderByScore(entries, direction);
  const order = entries
    .map((entry, i) => ({ id: entry.id, place: places.get(entry.id)!, i }))
    .sort((x, y) => x.place - y.place || x.i - y.i)
    .map((entry) => entry.id);
  return { order, tied: new Set(places.values()).size < entries.length };
}
