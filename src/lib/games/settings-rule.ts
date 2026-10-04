/**
 * What a Head-to-head or Best score Competition's settings change must leave consistent with
 * the Games already logged (R3 decision 11): a Best of fits its Games, a
 * fixed list keeps everyone who has played, draws stay on while a Game is
 * a draw. Pure; the mutation loads the rows under the Competition's lock.
 */

/** A logged Game's players: a Team or Participant id, its name, its place. */
export type LoggedGame = {
  players: { id: string; name: string; place: number | null }[];
};

export const DRAW_LOGGED =
  "A Match here is a draw. Delete or edit it before turning draws off.";

/** A Best of whose Games are too many, or not between its 2 Entrants. */
export const bestOfMisfit = (bestOf: number) =>
  `These Matches don't fit a Best of ${bestOf}.`;

/** A fixed list that would leave out someone who has played. */
export const loggedOffList = (name: string) =>
  `${name} has logged Matches or Attempts. Add them as an Entrant or delete those first.`;

/**
 * Why the new settings don't fit the logged Games, or null. In order: a
 * Best of (`bestOf`, null when off) with more Games than its length or a
 * Game not between its Entrants; open to everyone turned into a fixed list
 * that leaves out a player; draws turned off (`drawsAllowed` false; null
 * for a Format without draws) while a head-to-head Game is a draw.
 */
export function loggedGamesSettingsError({
  wasOpen,
  entrantsOpen,
  bestOf,
  drawsAllowed,
  entrantIds,
  games,
}: {
  wasOpen: boolean;
  entrantsOpen: boolean;
  bestOf: number | null;
  drawsAllowed: boolean | null;
  entrantIds: string[];
  games: LoggedGame[];
}): string | null {
  const entered = new Set(entrantIds);
  if (bestOf !== null) {
    const between = games.every((g) =>
      g.players.every((p) => entered.has(p.id)),
    );
    if (games.length > bestOf || !between) return bestOfMisfit(bestOf);
  }
  if (wasOpen && !entrantsOpen) {
    const off = games.flatMap((g) => g.players).find((p) => !entered.has(p.id));
    if (off) return loggedOffList(off.name);
  }
  if (drawsAllowed === false) {
    const drawn = games.some(
      (g) => g.players.length === 2 && g.players.every((p) => p.place === 1),
    );
    if (drawn) return DRAW_LOGGED;
  }
  return null;
}
