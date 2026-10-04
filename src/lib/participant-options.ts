/**
 * The one Participant picker's option data (`ParticipantPicker`): who a
 * Participant is to someone choosing them. Names, a picture, a Team and an
 * optional note, never an email: nothing here can carry one, so no page
 * payload or search can either (spec, People and admin, Decision 3).
 */
export type ParticipantOption = {
  id: string;
  /** The shown name: the Profile name, else the roster name. */
  name: string;
  /** A picture URL, or null for initials. */
  image: string | null;
  /** The Participant's Team name; null in a free-for-all or with no Team. */
  teamName: string | null;
  /** The Participant's Team color, for the initials Avatar; null for none. */
  teamColor: string | null;
  /** A short note beside the name: "Can't sign in", "in Red Squad". */
  note?: string;
  /** A Team offered where a Participant may also be chosen (Discretionary points). */
  kind?: "team";
  disabled?: boolean;
};

/** The fields a source row may carry; anything else on it (an email) is dropped. */
export type ParticipantOptionSource = {
  id: string;
  name: string;
  image?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
  note?: string;
  kind?: "team";
  disabled?: boolean;
};

/** Copies only the picker's fields from each row, so nothing else rides along. */
export function buildParticipantOptions(
  rows: ParticipantOptionSource[],
): ParticipantOption[] {
  return rows.map((row) => {
    const option: ParticipantOption = {
      id: row.id,
      name: row.name,
      image: row.image ?? null,
      teamName: row.teamName ?? null,
      teamColor: row.teamColor ?? null,
    };
    if (row.note) option.note = row.note;
    if (row.kind) option.kind = row.kind;
    if (row.disabled) option.disabled = true;
    return option;
  });
}

/**
 * Whether a display name fits the typed query: a case-insensitive substring
 * of the name alone. Not the Team, the note or an email.
 */
export function nameMatches(name: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return name.toLowerCase().includes(needle);
}

/** The options whose name fits the query. No cap: every match is returned. */
export function filterParticipantOptions(
  options: ParticipantOption[],
  query: string,
): ParticipantOption[] {
  return options.filter((option) => nameMatches(option.name, query));
}

/** The muted text beside a name: the Team's name, then the note. */
export function optionDetail(option: ParticipantOption): string | undefined {
  const parts = [option.teamName, option.note].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** A Participant as the forms' queries return one (`team` is the Team's name). */
export type TargetParticipant = {
  id: string;
  name: string;
  team: string | null;
  teamColor?: string | null;
  image?: string | null;
};

/** The picker's options from those rows, keeping nothing but what it shows. */
export function optionsFromTargets(
  participants: TargetParticipant[],
): ParticipantOption[] {
  return buildParticipantOptions(
    participants.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image,
      teamName: p.team,
      teamColor: p.teamColor,
    })),
  );
}
