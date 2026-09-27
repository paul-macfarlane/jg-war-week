"use client";

import { cn } from "cn";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { type DateRange, getDefaultClassNames } from "react-day-picker";

import { FormValueInput } from "@/components/form-value-input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  formatDateLabel,
  formatDateValue,
  parseDateValue,
} from "@/lib/date-value";
import { type PendingRange, nextRangeSelection } from "@/lib/day-range";

// Tailwind's `sm` breakpoint: two months side by side from here up.
const WIDE_QUERY = "(min-width: 40rem)";

type DateRangeValue = { start: string; end: string };

type DateRangePickerProps = {
  startName: string;
  endName: string;
  /** Both `YYYY-MM-DD`, or "". */
  value: DateRangeValue;
  onValueChange: (value: DateRangeValue) => void;
  /** The War Week's existing Day dates, `YYYY-MM-DD`. */
  days: string[];
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
};

const dotClass =
  "before:pointer-events-none before:absolute before:bottom-1 before:left-1/2 before:z-20 before:size-1 before:-translate-x-1/2 before:rounded-full";

/**
 * The War Week's start and end dates as one calendar range. Existing Days
 * show as dots. A range that would leave a Day outside it is refused with
 * the same text the settings save shows, and those Days are marked.
 * Posts both dates (`YYYY-MM-DD`) under `startName` and `endName`.
 */
export function DateRangePicker({
  startName,
  endName,
  value,
  onValueChange,
  days,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DateRangePickerProps) {
  const wide = useMediaQuery(WIDE_QUERY);
  const [open, setOpen] = useState(false);
  // A half-picked or refused range stays on screen until the next tap;
  // only an accepted range reaches `onValueChange`.
  const [pending, setPending] = useState<PendingRange | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = parseDateValue(value.start);
  const to = parseDateValue(value.end);
  const selected: DateRange | undefined = pending
    ? {
        from: parseDateValue(pending.from),
        to: pending.to ? parseDateValue(pending.to) : undefined,
      }
    : from
      ? { from, to }
      : undefined;

  const outsideDates = new Set<string>();
  if (error && pending?.to) {
    for (const day of days) {
      if (day < pending.from || day > pending.to) outsideDates.add(day);
    }
  }
  const toDates = (dates: string[]) =>
    dates.flatMap((date) => parseDateValue(date) ?? []);

  function openChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPending(null);
      setError(null);
    }
  }

  // Taps are handled here rather than by react-day-picker's range
  // selection, which would finish a range (or move an end of the saved one)
  // on the first tap.
  function tap(date: Date) {
    const next = nextRangeSelection(pending, formatDateValue(date), days);
    setPending(next.pending);
    setError(next.error ?? null);
    if (next.commit) {
      onValueChange(next.commit);
      setOpen(false);
    }
  }

  return (
    <span className="relative flex">
      <Popover open={open} onOpenChange={openChange}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-label={ariaLabel}
              aria-invalid={ariaInvalid}
              className="h-11 w-full justify-start font-normal sm:h-9 sm:w-auto"
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {from ? (
            <span className="truncate">
              {formatDateLabel(from)} – {to ? formatDateLabel(to) : "…"}
            </span>
          ) : (
            <span className="text-muted-foreground">Pick the dates</span>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
        >
          <Calendar
            mode="range"
            numberOfMonths={wide ? 2 : 1}
            selected={selected}
            defaultMonth={from}
            // A no-op `onSelect` keeps `selected` controlled; `tap` owns it.
            onSelect={() => {}}
            onDayClick={tap}
            modifiers={{
              hasDay: toDates(days.filter((day) => !outsideDates.has(day))),
              dayOutside: toDates([...outsideDates]),
            }}
            modifiersClassNames={{
              hasDay: cn(dotClass, "before:bg-foreground/60"),
              dayOutside: cn(dotClass, "before:size-1.5 before:bg-destructive"),
            }}
            classNames={{
              months: cn(
                "relative flex flex-col gap-4 sm:flex-row",
                getDefaultClassNames().months,
              ),
            }}
            className="[--cell-size:--spacing(11)] sm:[--cell-size:--spacing(8)]"
          />
          {error && (
            <p
              role="alert"
              className="text-destructive max-w-[calc(100vw-2rem)] px-3 pb-3 text-sm sm:max-w-md"
            >
              {error}
            </p>
          )}
        </PopoverContent>
      </Popover>
      <FormValueInput name={startName} value={value.start} />
      <FormValueInput name={endName} value={value.end} />
    </span>
  );
}
