/**
 * A roster Participant as the Hosts picker needs them: their shown name
 * and whether their roster email can never sign in. Never the email itself
 * (the picker, its keywords and the page payload carry none).
 */
export type HostCandidate = {
  id: string;
  name: string;
  /** A roster email that isn't @jahnelgroup.com; a missing email is not. */
  cantSignIn: boolean;
};

/** One picker option (fits `EntityComboboxItem`). */
export type HostOption = {
  /** The Participant's id (what is stored). */
  id: string;
  label: string;
  /** "Can't sign in" for a Participant whose roster email is not JG. */
  detail?: string;
};

export const CANT_SIGN_IN = "Can't sign in";

/**
 * The Hosts picker's options: every roster Participant by name, selectable
 * with or without an email (a Host chosen before they have one gets access
 * once an Organizer adds it in Roster). One whose roster email isn't
 * @jahnelgroup.com is marked "Can't sign in", without the email.
 */
export function buildHostOptions(candidates: HostCandidate[]): HostOption[] {
  return candidates.map(({ id, name, cantSignIn }) =>
    cantSignIn
      ? { id, label: name, detail: CANT_SIGN_IN }
      : { id, label: name },
  );
}
