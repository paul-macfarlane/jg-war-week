/**
 * What a Head-to-head's settings change must leave consistent with the
 * Matches already logged (R3 decision 11): the Best of fits its Matches,
 * and draws stay on while a Match is a Draw. Pure; the mutation loads the
 * rows under the Competition's lock.
 */
import type { ResultFact } from "@/lib/logged-results";
import type { SeriesConfig } from "@/lib/series/config";

export const DRAW_LOGGED =
  "A Match here is a draw. Delete or edit it before turning draws off.";

/** A Best of shorter than its Matches. */
export const bestOfMisfit = (bestOf: number) =>
  `These Matches don't fit a Best of ${bestOf}.`;

/**
 * Why the new settings don't fit the logged Matches, or null. In order: a
 * Best of with more Matches than its length; draws turned off while a
 * Match is a Draw.
 */
export function loggedMatchesSettingsError(
  config: SeriesConfig,
  matches: Pick<ResultFact, "players">[],
): string | null {
  if (matches.length > config.bestOf) return bestOfMisfit(config.bestOf);
  if (!config.drawsAllowed) {
    const drawn = matches.some(
      (m) => m.players.length === 2 && m.players.every((p) => p.place === 1),
    );
    if (drawn) return DRAW_LOGGED;
  }
  return null;
}
