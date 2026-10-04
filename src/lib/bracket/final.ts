/**
 * Which Match is the final, the one rule every reader uses: the Match of the
 * last Round that isn't the 3rd place Match. Never "the only Match of the
 * last Round": with a 3rd place Match, that Round holds two. Pure.
 */
import type { Bracket, Match } from "@/lib/bracket/types";

/** The final's Round number; 0 before Generate. */
export function finalRoundOf(bracket: Pick<Bracket, "matches">): number {
  return bracket.matches.reduce((max, h) => Math.max(max, h.round), 0);
}

/** The final; undefined before Generate. */
export function finalMatchOf(
  bracket: Pick<Bracket, "matches">,
): Match | undefined {
  const round = finalRoundOf(bracket);
  return bracket.matches.find((h) => h.round === round && !h.thirdPlace);
}

/** The 3rd place Match, when the Bracket has one. */
export function thirdPlaceMatchOf(
  bracket: Pick<Bracket, "matches">,
): Match | undefined {
  return bracket.matches.find((h) => h.thirdPlace);
}
