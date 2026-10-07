"use client";

import type { ReactNode } from "react";

import {
  EntityCombobox,
  type EntityComboboxItem,
} from "@/components/entity-combobox";
import { ParticipantPicker } from "@/components/participant-picker";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { EntrantKind } from "@/lib/bracket/squads";
import type { ParticipantOption } from "@/lib/participant-options";

export type EntrantsPickerItem = EntityComboboxItem;

const PLACEHOLDER: Record<EntrantKind, (label: string) => string> = {
  team: (label) => `Find a ${label}`,
  participant: () => "Find by name",
  squad: () => "Find a Squad",
};

const FIELD_LABEL: Record<EntrantKind, (label: string) => string> = {
  team: (label) => `${label}s`,
  participant: () => "Pick Participants",
  squad: () => "Squads",
};

/** The legend with the Entrants' autosave status beside it. */
function EntrantsLegend({
  legend,
  status,
}: {
  legend: string;
  status?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <FieldLegend>{legend}</FieldLegend>
      {status}
    </div>
  );
}

/**
 * The Entrants field: a multi-select combobox of Teams, Participants or
 * Squads, shared by the Bracket and League builders. It has no Save
 * button: the caller autosaves each change (`useEntrantsAutosave`) and
 * passes its `status` line, shown beside the legend, and a refusal's
 * `error`, shown under the picker. `note` sits above the combobox for
 * controls the caller owns, like the Bracket's "Entrants are" kind select
 * and "All Teams" quick-select.
 */
export function EntrantsPicker({
  id = "entrants-picker",
  legend = "Entrants",
  description,
  kind,
  kindLabel = "Team",
  options,
  participantOptions = [],
  selected,
  onChange,
  disabled = false,
  note,
  status,
  error,
}: {
  id?: string;
  legend?: string;
  description: ReactNode;
  kind: EntrantKind;
  /** The War Week's Team Label ("Team", "Cabin"…), for a team kind. */
  kindLabel?: string;
  /** The Teams or Squads to choose from (a Participant kind uses `participantOptions`). */
  options: EntrantsPickerItem[];
  /** The Participants to choose from, in a Participant kind. */
  participantOptions?: ParticipantOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  note?: ReactNode;
  /** The autosave status line, beside the legend. */
  status?: ReactNode;
  /** The server's refusal of the last change, under the picker. */
  error?: string;
}) {
  return (
    <FieldSet>
      <EntrantsLegend legend={legend} status={status} />
      <FieldDescription>{description}</FieldDescription>
      <FieldGroup className="gap-3">
        {note}
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor={id}>
            {FIELD_LABEL[kind](kindLabel)} ({selected.length} chosen)
          </FieldLabel>
          {kind === "participant" ? (
            <ParticipantPicker
              id={id}
              multiple
              options={participantOptions}
              value={selected}
              onValueChange={onChange}
              disabled={disabled}
              aria-invalid={!!error}
              placeholder={PLACEHOLDER[kind](kindLabel)}
            />
          ) : (
            <EntityCombobox
              id={id}
              multiple
              items={options}
              value={selected}
              onValueChange={onChange}
              disabled={disabled}
              aria-invalid={!!error}
              placeholder={PLACEHOLDER[kind](kindLabel)}
            />
          )}
          <FieldError>{error}</FieldError>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

/**
 * A Head-to-head's Entrants, "A vs B": two single pickers side by side
 * (stacked on a phone, the "vs" between them), Participants for an
 * individual Competition and Teams for a team one. Each leaves out the
 * other's choice. `value` is `[a, b]`, `""` for an empty side; the caller
 * saves the pair once both are set (`pairTargets`).
 */
export function EntrantsPair({
  id = "series-entrants",
  legend = "Entrants",
  description,
  kind,
  kindLabel = "Team",
  options,
  participantOptions = [],
  value,
  onChange,
  disabled = false,
  status,
  error,
}: {
  id?: string;
  legend?: string;
  description: ReactNode;
  kind: Exclude<EntrantKind, "squad">;
  /** The War Week's Team Label, for a team kind. */
  kindLabel?: string;
  /** The Teams to choose from, in a team kind. */
  options: EntrantsPickerItem[];
  /** The Participants to choose from, in a Participant kind. */
  participantOptions?: ParticipantOption[];
  value: [string, string];
  onChange: (value: [string, string]) => void;
  disabled?: boolean;
  status?: ReactNode;
  error?: string;
}) {
  const noun = kind === "participant" ? "Participant" : kindLabel;
  const side = (index: 0 | 1) => {
    const other = value[1 - index];
    const sideId = `${id}-${index === 0 ? "a" : "b"}`;
    const set = (next: string) =>
      onChange(index === 0 ? [next, value[1]] : [value[0], next]);
    const name = `${noun} ${index === 0 ? "A" : "B"}`;
    return (
      <Field data-invalid={!!error} className="min-w-0">
        <FieldLabel htmlFor={sideId}>{name}</FieldLabel>
        {kind === "participant" ? (
          <ParticipantPicker
            id={sideId}
            options={participantOptions.filter((p) => p.id !== other)}
            value={value[index]}
            onValueChange={set}
            clearLabel={`Clear ${name}`}
            disabled={disabled}
            aria-invalid={!!error}
            placeholder={PLACEHOLDER.participant(kindLabel)}
          />
        ) : (
          <EntityCombobox
            id={sideId}
            items={options.filter((t) => t.id !== other)}
            value={value[index]}
            onValueChange={set}
            clearLabel={`Clear ${name}`}
            disabled={disabled}
            aria-invalid={!!error}
            placeholder={PLACEHOLDER.team(kindLabel)}
          />
        )}
      </Field>
    );
  };
  return (
    <FieldSet>
      <EntrantsLegend legend={legend} status={status} />
      <FieldDescription>{description}</FieldDescription>
      <FieldGroup className="gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-4">
          {side(0)}
          <span
            aria-hidden
            className="text-foreground/70 text-center text-sm font-medium sm:pb-2.5"
          >
            vs
          </span>
          {side(1)}
        </div>
        <FieldError>{error}</FieldError>
      </FieldGroup>
    </FieldSet>
  );
}
