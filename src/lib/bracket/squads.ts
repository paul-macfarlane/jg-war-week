/**
 * The rules for a Squad: a named group of Participants of one Team, entered
 * as one Entrant in a team-scoring Bracket. Pure; the mutations load the
 * rows and call these under the Competition's row lock.
 */
import type { FieldErrors } from "@/lib/result";

export const SQUAD_NAME_MAX = 80;
export const SQUAD_PARTICIPANTS_MAX = 16;
export const SQUAD_LIMITS = {
  nameMax: SQUAD_NAME_MAX,
  participantsMax: SQUAD_PARTICIPANTS_MAX,
} as const;

/** What an Entrant list is made of; one kind per Bracket. */
export type EntrantKind = "team" | "participant" | "squad";

export type SquadCheck = {
  name: string;
  teamId: string | null;
  /** The chosen Participants, as loaded (their current Team). */
  participants: { id: string; displayName: string; teamId: string | null }[];
  /** Participant id → the other Squad of this Competition they're in. */
  taken: Record<string, string>;
  /** The War Week's Team Label; "Team" when not given. */
  teamLabel?: string;
};

const refusal = (field: string, error: string) => ({
  error,
  fieldErrors: { [field]: error } as FieldErrors,
});

/**
 * Why this Squad can't be saved, or null: the name (1–80 characters), then
 * the Team, then the Participants (1–16, all on the Squad's Team, none
 * already in another Squad of the Competition).
 */
export function squadError({
  name,
  teamId,
  participants,
  taken,
  teamLabel = "Team",
}: SquadCheck): { error: string; fieldErrors: FieldErrors } | null {
  const trimmed = name.trim();
  if (!trimmed) return refusal("name", "Enter the Squad's name.");
  if (trimmed.length > SQUAD_NAME_MAX) {
    return refusal(
      "name",
      `Keep the name to ${SQUAD_NAME_MAX} characters or fewer.`,
    );
  }
  if (!teamId) return refusal("teamId", `Choose a ${teamLabel}.`);
  if (participants.length === 0) {
    return refusal("participantIds", "Add at least one Participant.");
  }
  if (participants.length > SQUAD_PARTICIPANTS_MAX) {
    return refusal(
      "participantIds",
      `A Squad has at most ${SQUAD_PARTICIPANTS_MAX} Participants.`,
    );
  }
  if (participants.some((p) => p.teamId !== teamId)) {
    return refusal(
      "participantIds",
      `Every Participant in a Squad must be on the same ${teamLabel}.`,
    );
  }
  const inOther = participants.find((p) => taken[p.id] !== undefined);
  if (inOther) {
    return refusal(
      "participantIds",
      `${inOther.displayName} is already in ${taken[inOther.id]}.`,
    );
  }
  return null;
}

/**
 * Why a Competition of this scoring can't take Entrants of this kind, or
 * null: Teams or Squads for a team Competition, Participants for an
 * individual one.
 */
export function entrantKindError(
  scoring: "team" | "individual",
  kind: EntrantKind,
): string | null {
  if (scoring === "team") {
    return kind === "participant"
      ? "A team Competition's Entrants are Teams or Squads."
      : null;
  }
  return kind === "participant"
    ? null
    : "An individual Competition's Entrants are Participants.";
}

/** "Red Alpha · Red · Ashley Schuliger, Sam Schantz". */
export function squadLabel(squad: {
  name: string;
  teamName: string;
  participants: { displayName: string }[];
}): string {
  return [
    squad.name,
    squad.teamName,
    squad.participants.map((p) => p.displayName).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}
