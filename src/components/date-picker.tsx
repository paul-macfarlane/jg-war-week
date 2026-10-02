"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";

import { FormValueInput } from "@/components/form-value-input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatDateLabel,
  formatDateValue,
  parseDateValue,
} from "@/lib/date-value";

type DatePickerProps = {
  name: string;
  /** `YYYY-MM-DD`, or "" for no date. */
  value: string;
  onValueChange: (value: string) => void;
  /** Earliest pickable date, `YYYY-MM-DD`. */
  min?: string;
  /** Latest pickable date, `YYYY-MM-DD`. */
  max?: string;
  /** Extra dates to grey out, on top of `min` and `max`. */
  disabled?: (date: Date) => boolean;
  required?: boolean;
  id?: string;
  "aria-label"?: string;
  /** Marks the control invalid when its field shows an error. */
  "aria-invalid"?: boolean;
};

/**
 * A date field: a button showing the date that opens a calendar. Posts
 * `YYYY-MM-DD` under `name`, like `<input type="date">` did.
 */
export function DatePicker({
  name,
  value,
  onValueChange,
  min,
  max,
  disabled: isDisabled,
  required,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const minDate = min ? parseDateValue(min) : undefined;
  const maxDate = max ? parseDateValue(max) : undefined;
  const disabled: Matcher[] = [];
  if (minDate) disabled.push({ before: minDate });
  if (maxDate) disabled.push({ after: maxDate });
  if (isDisabled) disabled.push(isDisabled);

  return (
    <span className="relative flex">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-label={ariaLabel}
              aria-invalid={ariaInvalid}
              className="h-11 w-full justify-start font-normal sm:h-9 sm:w-auto sm:min-w-44"
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {selected ? (
            formatDateLabel(selected)
          ) : (
            <span className="text-muted-foreground">Pick a date</span>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate}
            disabled={disabled}
            onSelect={(date) => {
              if (date) onValueChange(formatDateValue(date));
              setOpen(false);
            }}
            className="[--cell-size:--spacing(11)] sm:[--cell-size:--spacing(8)]"
          />
        </PopoverContent>
      </Popover>
      <FormValueInput name={name} value={value} required={required} />
    </span>
  );
}
