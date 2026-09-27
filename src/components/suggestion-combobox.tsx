"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

/**
 * A text field that suggests values already in use (a tap picks one) while
 * still accepting anything typed. The text is the value; the server action
 * validates it as before.
 */
export function SuggestionCombobox({
  suggestions,
  value,
  onValueChange,
  name,
  placeholder,
  maxLength,
  id,
}: {
  suggestions: string[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  placeholder?: string;
  maxLength?: number;
  id?: string;
}) {
  return (
    <Combobox
      items={suggestions}
      value={suggestions.includes(value) ? value : null}
      onValueChange={(picked) => {
        if (picked != null) onValueChange(picked);
      }}
      inputValue={value}
      onInputValueChange={(next, details) => {
        // Only typing changes the text; Base UI would otherwise reset free
        // text to the last picked suggestion when the list closes.
        if (details.reason === "input-change") onValueChange(next);
      }}
    >
      <ComboboxInput
        id={id}
        name={name}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        showTrigger={false}
        className="border-border h-9 w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>
          No suggestion fits. What you type is used as is.
        </ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
