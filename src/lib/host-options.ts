import {
  type ParticipantOption,
  buildParticipantOptions,
} from "@/lib/participant-options";

/**
 * A roster Participant as the Hosts picker needs them: what every
 * Participant picker shows, plus whether their roster email can never sign
 * in. Never the email itself (the picker, its search and the page payload
 * carry none).
 */
export type HostCandidate = {
  id: string;
  name: string;
  image?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
  /** A roster email that isn't @jahnelgroup.com; a missing email is not. */
  cantSignIn: boolean;
};

export const CANT_SIGN_IN = "Can't sign in";

/**
 * The Hosts picker's options: every roster Participant, selectable with or
 * without an email (a Host chosen before they have one gets access once an
 * Organizer adds it in Roster). One whose roster email isn't
 * @jahnelgroup.com is marked "Can't sign in", without the email.
 */
export function buildHostOptions(
  candidates: HostCandidate[],
): ParticipantOption[] {
  return buildParticipantOptions(
    candidates.map(({ cantSignIn, ...rest }) => ({
      ...rest,
      note: cantSignIn ? CANT_SIGN_IN : undefined,
    })),
  );
}
