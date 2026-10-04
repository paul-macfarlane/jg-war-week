import type { ReactNode } from "react";

import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import { TopFinishers } from "@/components/top-finishers";
import type { PodiumPlace } from "@/lib/bracket/podium";

/**
 * A Bracket's podium (spec R20, decision 5): the places it has decided as
 * Top finishers, each with its points, 1st marked Winner. The points are
 * Provisional until the Bracket is Closed. `after` adds the "You" tag.
 */
export function BracketPodium({
  places,
  entrantsById,
  scoring,
  primaryColor,
  closed,
  after,
}: {
  places: PodiumPlace[];
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: "team" | "individual";
  primaryColor: string;
  closed: boolean;
  after?: (entrantId: string) => ReactNode;
}) {
  const finishers = places.flatMap((place) => {
    const entrant = entrantsById.get(place.entrantId);
    return entrant
      ? [
          {
            key: `${place.place}:${entrant.id}`,
            place: place.place,
            name: entrant.label,
            points: place.points,
            lead: (
              <EntrantMark
                entrant={entrant}
                scoring={scoring}
                primaryColor={primaryColor}
              />
            ),
            after: after?.(entrant.id),
          },
        ]
      : [];
  });
  return <TopFinishers finishers={finishers} provisional={!closed} />;
}
