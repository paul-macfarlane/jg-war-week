import type { EntrantKind } from "@/lib/bracket/squads";

/** A Competition's Entrants as the per-field save takes them. */
export type EntrantsValue = { kind: EntrantKind; targetIds: string[] };

/**
 * Whether two Entrant lists are the same: the same kind and the same
 * Entrants in any order (saving reorders them by Seed Position). No
 * Entrants is no Entrants, whatever the kind.
 */
export function sameEntrants(a: EntrantsValue, b: EntrantsValue): boolean {
  if (a.targetIds.length === 0 && b.targetIds.length === 0) return true;
  if (a.kind !== b.kind || a.targetIds.length !== b.targetIds.length) {
    return false;
  }
  const set = new Set(b.targetIds);
  return a.targetIds.every((id) => set.has(id));
}

/**
 * A Head-to-head's pair to save, A then B, once both sides are set to two
 * different Entrants; null while either is empty, so clearing one side
 * leaves the saved pair alone.
 */
export function pairTargets(a: string, b: string): [string, string] | null {
  return a && b && a !== b ? [a, b] : null;
}
