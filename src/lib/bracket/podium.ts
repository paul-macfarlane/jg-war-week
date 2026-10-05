/**
 * The Bracket's podium (spec R20, decision 5): the places a Bracket
 * decides, each with its points. Pure, so the Participant view, Bracket
 * admin and the tests share one rule.
 */
import type { Competition } from "@/db/schema";
import { finalMatchOf, thirdPlaceMatchOf } from "@/lib/bracket/final";
import { isDecided } from "@/lib/bracket/match-status";
import { pointsFor } from "@/lib/bracket/points";
import type { Bracket, Match, Placing } from "@/lib/bracket/types";
import { BRACKET_PLACEMENTS } from "@/lib/competitions";
import type { EntryPoints } from "@/lib/results-table";

/** A decided place and what it earns; null points when it earns none. */
export type PodiumPlace = Placing & { points: number | null };

/** Where an Entrant's Points Entry goes, as the close step writes it. */
export type PodiumEntrant = {
  id: string;
  /** The Team, or a Squad's Team; null for a Participant. */
  pointsTeamId: string | null;
  participantId: string | null;
};

/** A played Match's places, `offset` added, up to the Bracket's last place. */
function placesOf(match: Match | undefined, offset: number): Placing[] {
  if (!match || !isDecided(match)) return [];
  return match.slots.flatMap((slot) =>
    slot.entrantId !== null &&
    slot.place !== null &&
    slot.place + offset <= BRACKET_PLACEMENTS
      ? [{ entrantId: slot.entrantId, place: slot.place + offset }]
      : [],
  );
}

/**
 * The places a Bracket has decided, by place: 1st and 2nd (a Group
 * final: its whole order, up to 4th) once the final is played; 3rd and
 * 4th once a 3rd place match is played. Semifinal losers with no 3rd place
 * match are not placed.
 */
export function decidedPlaces(bracket: Pick<Bracket, "matches">): Placing[] {
  return [
    ...placesOf(finalMatchOf(bracket), 0),
    ...placesOf(thirdPlaceMatchOf(bracket), 2),
  ].sort((a, b) => a.place - b.place);
}

const targetKey = (entrant: {
  teamId?: string | null;
  participantId?: string | null;
}) =>
  entrant.teamId
    ? `team:${entrant.teamId}`
    : entrant.participantId
      ? `participant:${entrant.participantId}`
      : null;

/**
 * Each place's points from a Closed Bracket's Points Entries. Entries
 * carry a target, not an Entrant, so two Squads of one Team share one: the
 * better place takes the larger entry, as the close step gave it.
 */
function closedPoints(
  places: Placing[],
  entrants: Map<string, PodiumEntrant>,
  entryPoints: EntryPoints[],
): Map<string, number | null> {
  const pool = new Map<string, number[]>();
  for (const entry of entryPoints) {
    const key = targetKey(entry);
    if (key) pool.set(key, [...(pool.get(key) ?? []), entry.points]);
  }
  for (const points of pool.values()) points.sort((a, b) => b - a);
  const result = new Map<string, number | null>();
  for (const { entrantId } of places) {
    const entrant = entrants.get(entrantId);
    const key = entrant
      ? targetKey({
          teamId: entrant.pointsTeamId,
          participantId: entrant.participantId,
        })
      : null;
    result.set(entrantId, (key ? pool.get(key)?.shift() : undefined) ?? null);
  }
  return result;
}

/**
 * The podium: every decided place with its points. Until the Bracket is
 * Closed (`entryPoints` null) the points are Provisional, by the rule the
 * close step uses (`pointsFor`); once Closed they are its Points Entries.
 */
export function podium({
  bracket,
  entrants,
  placementPoints,
  entryPoints,
}: {
  bracket: Pick<Bracket, "matches">;
  entrants: PodiumEntrant[];
  placementPoints: Competition["placementPoints"];
  /** A Closed Bracket's Points Entries; null while it isn't Closed. */
  entryPoints: EntryPoints[] | null;
}): PodiumPlace[] {
  const places = decidedPlaces(bracket);
  const points =
    entryPoints === null
      ? new Map(
          pointsFor(places, { placementPoints }).map((p) => [
            p.entrantId,
            p.points,
          ]),
        )
      : closedPoints(
          places,
          new Map(entrants.map((e) => [e.id, e])),
          entryPoints,
        );
  return places.map((place) => ({
    ...place,
    points: points.get(place.entrantId) ?? null,
  }));
}

/** A loaded Bracket's podium (`getBracket`'s view): Provisional until Closed. */
export function podiumOf(view: {
  bracket: Pick<Bracket, "matches">;
  entrants: PodiumEntrant[];
  competition: Pick<Competition, "placementPoints">;
  closed: boolean;
  entryPoints: EntryPoints[];
}): PodiumPlace[] {
  return podium({
    bracket: view.bracket,
    entrants: view.entrants,
    placementPoints: view.competition.placementPoints,
    entryPoints: view.closed ? view.entryPoints : null,
  });
}
