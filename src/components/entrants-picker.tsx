"use client";

import type { ReactNode } from "react";

import {
  EntityCombobox,
  type EntityComboboxItem,
} from "@/components/entity-combobox";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { EntrantKind } from "@/lib/bracket/squads";

export type EntrantsPickerItem = EntityComboboxItem;

const PLACEHOLDER: Record<EntrantKind, (label: string) => string> = {
  team: (label) => `Find a ${label}`,
  participant: (label) => `Find by name or ${label}`,
  squad: () => "Find a Squad",
};

const FIELD_LABEL: Record<EntrantKind, (label: string) => string> = {
  team: (label) => `${label}s`,
  participant: () => "Pick Participants",
  squad: () => "Squads",
};

/**
 * The Entrants field: a multi-select combobox of Teams, Participants or
 * Squads and its Save button, shared by the Bracket and Head-to-head builders
 * (extracted from `BracketBuilder`, no behavior change there). `note` sits
 * above the combobox for controls the caller owns, like the Bracket's
 * "Entrants are" kind select and "All Teams" quick-select.
 */
export function EntrantsPicker({
  id = "entrants-picker",
  legend = "Entrants",
  description,
  kind,
  kindLabel = "Team",
  options,
  selected,
  onChange,
  onSave,
  saveLabel = "Save Entrants",
  disabled = false,
  saveDisabled = false,
  note,
}: {
  id?: string;
  legend?: string;
  description: ReactNode;
  kind: EntrantKind;
  /** The War Week's Team Label ("Team", "Cabin"…), for a team kind. */
  kindLabel?: string;
  options: EntrantsPickerItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onSave: () => void;
  saveLabel?: string;
  disabled?: boolean;
  saveDisabled?: boolean;
  note?: ReactNode;
}) {
  return (
    <FieldSet>
      <FieldLegend>{legend}</FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      <FieldGroup className="gap-3">
        {note}
        <Field>
          <FieldLabel htmlFor={id}>
            {FIELD_LABEL[kind](kindLabel)} ({selected.length} chosen)
          </FieldLabel>
          <EntityCombobox
            id={id}
            multiple
            items={options}
            value={selected}
            onValueChange={onChange}
            disabled={disabled}
            placeholder={PLACEHOLDER[kind](kindLabel)}
          />
        </Field>
        <Button
          type="button"
          size="lg"
          className="min-h-11 w-fit"
          disabled={disabled || saveDisabled}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
      </FieldGroup>
    </FieldSet>
  );
}
