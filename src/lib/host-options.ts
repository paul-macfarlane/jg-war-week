import { isJahnelGroupEmail } from "@/lib/access";

/** A roster Participant as the Hosts picker needs them (name per Profile). */
export type HostCandidate = {
  id: string;
  name: string;
  email: string | null;
};

/** One picker option (fits `EntityComboboxItem`). */
export type HostOption = {
  id: string;
  label: string;
  /** The email beneath the name, or the reason a disabled option is. */
  detail: string;
  /** Shown but not selectable; `detail` says why. */
  disabled?: boolean;
};

/**
 * The Hosts picker's options: each roster Participant by name with the
 * email beneath. One whose email can't sign in (none, or not
 * @jahnelgroup.com) is shown disabled with the reason. A Host already
 * assigned whose email is off the roster is kept, with a warning, so an
 * Organizer can still remove them. An option's id is the lowercase email
 * (what is stored); a disabled one has no email to use, so it takes the
 * Participant's id.
 */
export function buildHostOptions(
  candidates: HostCandidate[],
  currentHosts: string[],
): HostOption[] {
  const options: HostOption[] = [];
  const onRoster = new Set<string>();
  for (const { id, name, email } of candidates) {
    const trimmed = email?.trim().toLowerCase() ?? "";
    if (!trimmed) {
      options.push({
        id: `participant:${id}`,
        label: name,
        detail: "Add an email in Roster",
        disabled: true,
      });
    } else if (!isJahnelGroupEmail(trimmed)) {
      options.push({
        id: `participant:${id}`,
        label: name,
        detail: `${trimmed} · Only @jahnelgroup.com emails can sign in`,
        disabled: true,
      });
    } else if (!onRoster.has(trimmed)) {
      onRoster.add(trimmed);
      options.push({ id: trimmed, label: name, detail: trimmed });
    }
  }
  for (const host of currentHosts) {
    const email = host.trim().toLowerCase();
    if (onRoster.has(email)) continue;
    onRoster.add(email);
    options.push({
      id: email,
      label: `${email} (not on the roster)`,
      detail: "Not on the roster",
    });
  }
  return options;
}
