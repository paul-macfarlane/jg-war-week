/**
 * Which Heat is the final, the one rule every reader uses: the Heat of the
 * last Round that isn't the 3rd place game. Never "the only Heat of the
 * last Round": with a 3rd place game, that Round holds two. Pure.
 */
import type { Bracket, Heat } from "@/lib/bracket/types";

/** The final's Round number; 0 before Generate. */
export function finalRoundOf(bracket: Pick<Bracket, "heats">): number {
  return bracket.heats.reduce((max, h) => Math.max(max, h.round), 0);
}

/** The final; undefined before Generate. */
export function finalHeatOf(bracket: Pick<Bracket, "heats">): Heat | undefined {
  const round = finalRoundOf(bracket);
  return bracket.heats.find((h) => h.round === round && !h.thirdPlace);
}

/** The 3rd place game, when the Bracket has one. */
export function thirdPlaceHeatOf(
  bracket: Pick<Bracket, "heats">,
): Heat | undefined {
  return bracket.heats.find((h) => h.thirdPlace);
}
