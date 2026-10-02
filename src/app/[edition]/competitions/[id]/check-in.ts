import type { CheckInOffer } from "@/components/check-in-button";
import { checkInError, checkOutError } from "@/lib/participation/check-in-rule";
import { getCheckInFacts } from "@/queries/participation";

/**
 * What the Participant linked to `email` may do about checking in to this
 * `participation` Competition (ADR 0009), worked out with the same rules
 * the Check in actions run: null unless Self check-in is on, the
 * Competition is open and the email links a Participant. The page gets
 * booleans and the rule's refusal, never the email.
 */
export async function checkInOfferFor(
  competitionId: string,
  email: string | null,
): Promise<CheckInOffer | null> {
  if (!email) return null;
  const { checkIn: facet, linked } = await getCheckInFacts(
    competitionId,
    email,
  );
  if (!facet.isParticipation || !facet.selfCheckIn || facet.closed) {
    return null;
  }
  if (!linked) return null;
  const checkedIn = facet.mark !== null;
  return {
    competitionId,
    checkedIn,
    reason: checkedIn ? checkOutError(facet) : checkInError(facet),
  };
}
