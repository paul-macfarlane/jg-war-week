/**
 * The Bracket Finale's rows (`/<edition>/finale/<competitionId>`): a
 * finalized Bracket's final placings, counted in from last place to first.
 * Pure: the placings come from the Bracket's engine as is; nothing here
 * reads or recomputes Standings.
 */
import type { Entrant, Placing } from "@/lib/bracket/types";

export type BracketFinaleEntrant = Entrant & { color: string | null };

export type BracketFinaleRow = {
  entrantId: string;
  label: string;
  /** The Entrant's Team color, or null without one. */
  color: string | null;
  place: number;
};

/** Each placed Entrant with its label and color, by place then Seed Position. */
export function bracketFinaleRows(
  placings: Placing[],
  entrants: BracketFinaleEntrant[],
): BracketFinaleRow[] {
  const byId = new Map(entrants.map((e) => [e.id, e]));
  return placings
    .flatMap(({ entrantId, place }) => {
      const entrant = byId.get(entrantId);
      return entrant ? [{ entrant, place }] : [];
    })
    .sort(
      (a, b) =>
        a.place - b.place || a.entrant.seedPosition - b.entrant.seedPosition,
    )
    .map(({ entrant, place }) => ({
      entrantId: entrant.id,
      label: entrant.label,
      color: entrant.color,
      place,
    }));
}

/**
 * The Finale ranks for these rows: their places, so tied places appear
 * together and the champion is the last step shown.
 */
export function bracketFinaleRanks(rows: BracketFinaleRow[]): number[] {
  return rows.map((row) => row.place);
}
