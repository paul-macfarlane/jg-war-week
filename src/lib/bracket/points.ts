import type { Competition } from "@/db/schema";
import type { Placing } from "@/lib/bracket/types";
import { pointsForPlacement } from "@/lib/competitions";

export type BracketPoints = { entrantId: string; points: number };

/**
 * Points Entry drafts from final placings: each place (1–4, from the final
 * and the 3rd place Match) with Placement Points gets them, and tied places each get that place's points (ties are
 * equal entries). Places without Placement Points get no entry.
 */
export function pointsFor(
  placings: Placing[],
  competition: Pick<Competition, "placementPoints">,
): BracketPoints[] {
  return placings.flatMap(({ entrantId, place }) => {
    const points = pointsForPlacement(competition, place);
    return points === null ? [] : [{ entrantId, points }];
  });
}
