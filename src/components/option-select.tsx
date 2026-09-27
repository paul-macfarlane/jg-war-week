"use client";

import { FormValueInput } from "@/components/form-value-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/** Base UI's Select won't accept `""` as an item value. */
const EMPTY = "__none__";

const toItemValue = (value: string) => (value === "" ? EMPTY : value);

/**
 * A themed select over a short fixed list, shown by label. An option may
 * use `""` as its value (e.g. "No Team"). Posts the chosen value under
 * `name`, like a native `<select>` did.
 */
export function OptionSelect({
  name,
  value,
  onValueChange,
  options,
  required,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  required?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}) {
  const items = options.map((option) => ({
    value: toItemValue(option.value),
    label: option.label,
    disabled: option.disabled,
  }));

  return (
    <span className="relative flex flex-col">
      <Select
        value={toItemValue(value)}
        items={items}
        disabled={disabled}
        onValueChange={(next) =>
          onValueChange(!next || next === EMPTY ? "" : next)
        }
      >
        <SelectTrigger
          id={id}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          className="h-11 w-full sm:h-9"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className="min-h-11 sm:min-h-8"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {name && <FormValueInput name={name} value={value} required={required} />}
    </span>
  );
}
