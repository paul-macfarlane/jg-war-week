"use client";

import { useMemo, useState } from "react";

import { FormValueInput } from "@/components/form-value-input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  type TimeOption,
  formatTime12,
  parseTime,
  timeOptions,
} from "@/lib/time-options";

type TimeComboboxProps = {
  name: string;
  /** `HH:MM` on the 24-hour clock, or "" for no time. */
  value: string;
  onValueChange: (value: string) => void;
  /** A start time: options after it show the duration ("8:30 PM · 1h"). */
  start?: string;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
  /** Marks the control invalid when its field shows an error. */
  "aria-invalid"?: boolean;
  placeholder?: string;
};

function labelFor(value: string): string {
  return value ? formatTime12(value) : "";
}

/**
 * A time field: pick from every 5 minutes, or type a time ("7:32p",
 * "19:30") and press Enter or leave the field. Shows the 12-hour time and
 * posts `HH:MM` (or "") under `name`, like `<input type="time">` did.
 */
export function TimeCombobox({
  name,
  value,
  onValueChange,
  start,
  required,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  placeholder,
}: TimeComboboxProps) {
  const options = useMemo(() => timeOptions(start), [start]);
  const [text, setText] = useState(labelFor(value));
  const [shownValue, setShownValue] = useState(value);
  const [open, setOpen] = useState(false);
  // Keep the typed text in step when the value changes from outside.
  if (shownValue !== value) {
    setShownValue(value);
    setText(labelFor(value));
  }

  // Off-step values (7:32 PM) aren't in the list but are still selected.
  const selected: TimeOption | null = value
    ? (options.find((option) => option.value === value) ?? {
        value,
        label: formatTime12(value),
      })
    : null;
  const typed = parseTime(text);

  function commit(next: string) {
    setText(labelFor(next));
    if (next !== value) onValueChange(next);
  }

  function commitTyped() {
    if (text.trim() === "") commit("");
    else if (typed) commit(typed);
    else setText(labelFor(value));
  }

  return (
    <Combobox<TimeOption>
      items={options}
      value={selected}
      onValueChange={(option) => commit(option?.value ?? "")}
      inputValue={text}
      onInputValueChange={setText}
      itemToStringLabel={(option) => formatTime12(option.value)}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(a, b) => a.value === b.value}
      autoHighlight
      open={open}
      onOpenChange={setOpen}
      filter={(option, query) => {
        const q = query.trim().toLowerCase();
        // Showing the chosen time (or nothing) lists every option.
        if (q === "" || query === labelFor(value)) return true;
        const parsed = parseTime(query);
        return (
          option.label.toLowerCase().includes(q) ||
          option.value.startsWith(q) ||
          (parsed !== null && option.value === parsed)
        );
      }}
    >
      <div className="relative flex flex-col">
        <ComboboxInput
          id={id}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          placeholder={placeholder}
          className="h-11 w-full sm:h-9"
          onBlur={commitTyped}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !typed) return;
            // Enter agrees with leaving the field: a typed time ("5", "7:32p")
            // wins over whichever option is highlighted.
            event.preventDefault();
            event.preventBaseUIHandler();
            commit(typed);
            setOpen(false);
          }}
        />
        <FormValueInput name={name} value={value} required={required} />
      </div>
      <ComboboxContent className="max-w-[min(var(--available-width),calc(100vw-2rem))]">
        <ComboboxEmpty>
          {typed
            ? `Press Enter to use ${formatTime12(typed)}`
            : "Type a time like 7:30 PM"}
        </ComboboxEmpty>
        <ComboboxList>
          {(option: TimeOption) => (
            <ComboboxItem
              key={option.value}
              value={option}
              className="min-h-11 sm:min-h-8"
            >
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
