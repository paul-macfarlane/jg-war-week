import type { EnrollOffer } from "@/components/enroll-button";
import {
  type EnrollFacet,
  enrollError,
  enrollmentUnavailable,
  onEntrantList,
  withdrawError,
} from "@/lib/bracket/enroll-rule";
import { getSquads } from "@/queries/brackets";
import { getEnrollFacts } from "@/queries/enrollment";

/**
 * What the Participant linked to `email` may do about entering this
 * Competition (ADR 0006), worked out with the same rules the enrollment
 * actions run: null unless the switch is on (and the Competition offers
 * enrollment) and the email links a Participant. In a team Competition with Squads, one Join or Leave per
 * Squad of their Team; otherwise Enroll or Withdraw.
 */
export async function enrollOfferFor(
  competition: { id: string; name: string },
  email: string | null,
): Promise<EnrollOffer | null> {
  if (!email) return null;
  const { enroll: facet, linked } = await getEnrollFacts(competition.id, email);
  if (!facet.selfEnroll || !linked || enrollmentUnavailable(facet)) {
    return null;
  }

  const entered = onEntrantList(facet.scoring, linked, facet.entrants);
  const bySquads =
    facet.scoring === "team" &&
    facet.hasSquads &&
    !entered &&
    linked.teamId !== null;
  const squads = bySquads
    ? (await getSquads(competition.id))
        .filter((s) => s.teamId === linked.teamId)
        .map((s) => {
          const squadFacet: EnrollFacet = {
            ...facet,
            squad: {
              id: s.id,
              teamId: s.teamId,
              participantCount: s.participants.length,
            },
          };
          const joined = linked.squadId === s.id;
          return {
            id: s.id,
            name: s.name,
            joined,
            reason: joined
              ? withdrawError(squadFacet)
              : enrollError(squadFacet),
          };
        })
    : null;

  return {
    competitionId: competition.id,
    competitionName: competition.name,
    scoring: facet.scoring,
    entrant: bySquads
      ? null
      : {
          entered,
          reason: entered ? withdrawError(facet) : enrollError(facet),
        },
    squads,
  };
}
