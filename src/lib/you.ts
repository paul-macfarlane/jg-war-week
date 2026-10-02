/**
 * Classes for a row that may hold a `YouTag`: it takes a ring and a
 * background in the Appearance Theme accent when the tag renders. Lives
 * here, not in the client component, so server components can use it.
 */
export const YOU_ROW_CLASS =
  "has-[[data-you]]:bg-accent/20 has-[[data-you]]:ring-accent has-[[data-you]]:rounded-md has-[[data-you]]:ring-2";

export type YouCandidate = {
  id: string;
  email?: string | null;
  /** The roster name as the Organizer typed it. */
  displayName?: string | null;
};

/** Who "you" are in a War Week. */
export type You = { participantId: string } | null;

const normalize = (email: string | null | undefined) =>
  email?.trim().toLowerCase() ?? "";

/**
 * Resolves the signed-in person to one of a War Week's Participants by
 * account linking: the session email matching a Participant email,
 * ignoring case. That is the only way; there is no self-pick. A read-time
 * match only; nothing is written anywhere.
 */
export function resolveYou({
  sessionEmail,
  participants,
}: {
  sessionEmail: string | null | undefined;
  participants: YouCandidate[];
}): You {
  const email = normalize(sessionEmail);
  if (!email) return null;
  const linked = participants.find((p) => normalize(p.email) === email);
  return linked ? { participantId: linked.id } : null;
}
