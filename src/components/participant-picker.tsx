"use client";

import { useMemo } from "react";

import { Avatar } from "@/components/avatar";
import {
  EntityCombobox,
  type EntityComboboxItem,
} from "@/components/entity-combobox";
import {
  type ParticipantOption,
  nameMatches,
  optionDetail,
} from "@/lib/participant-options";

type CommonProps = {
  options: ParticipantOption[];
  name?: string;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

export type ParticipantPickerProps =
  | (CommonProps & {
      multiple?: false;
      /** The chosen Participant's id, or `""`. */
      value: string;
      onValueChange: (id: string) => void;
    })
  | (CommonProps & {
      multiple: true;
      value: string[];
      onValueChange: (ids: string[]) => void;
    });

/** A Team offered beside Participants: a color dot, no Avatar. */
function TeamDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="bg-primary size-6 shrink-0 rounded-full"
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

function itemOf(option: ParticipantOption): EntityComboboxItem {
  return {
    id: option.id,
    label: option.name,
    detail: optionDetail(option),
    disabled: option.disabled,
    lead:
      option.kind === "team" ? (
        <TeamDot color={option.teamColor} />
      ) : (
        <Avatar
          name={option.name}
          teamColor={option.teamColor}
          image={option.image}
          className="size-6"
        />
      ),
  };
}

/**
 * The one Participant picker (CONTEXT.md, Participant picker): every place
 * an Organizer, Host or Participant chooses a Participant. Each row is
 * avatar · name · Team (the Team only in a teams War Week). It searches by
 * display name alone, with no cap on the list, and no option, keyword or
 * page payload carries an email. Single or multiple, like `EntityCombobox`,
 * which it is built on.
 */
export function ParticipantPicker({
  options,
  ...props
}: ParticipantPickerProps) {
  const items = useMemo(() => options.map(itemOf), [options]);
  return (
    <EntityCombobox
      {...props}
      items={items}
      filter={(item, query) => nameMatches(item.label, query)}
    />
  );
}
