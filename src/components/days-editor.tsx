"use client";

import { useId, useState } from "react";

import { createDay, deleteDay, updateDay } from "@/actions/setup";
import { DatePicker } from "@/components/date-picker";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
  usageSummary,
  useSetupRow,
} from "@/components/setup-row";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { dayDateDisabled } from "@/lib/day-range";
import { formatDayHeading } from "@/lib/schedule";
import type { SetupDay } from "@/queries/setup";

/** "2 Schedule Items": what keeps the Day from being deleted. */
function dayUsage(day: SetupDay): string {
  return usageSummary([
    [day.scheduleItemCount, "Schedule Item", "Schedule Items"],
  ]);
}

/**
 * One Day's date and Day Theme, in its Sheet. With no `day` it adds one.
 * The server action checks the date; its error is what's shown. `onSaved`
 * closes the Sheet.
 */
function DayForm({
  warWeekId,
  day,
  dayDates,
  startDate,
  endDate,
  onSaved,
}: {
  warWeekId: string;
  day?: SetupDay;
  /** Every Day's date in this War Week; taken dates are greyed out. */
  dayDates: string[];
  startDate: string;
  endDate: string;
  onSaved: () => void;
}) {
  const id = useId();
  const [date, setDate] = useState(day?.date ?? "");
  const [dayTheme, setDayTheme] = useState(day?.dayTheme ?? "");
  const { pending, formRef, formAction, fieldErrors, error } = useSetupRow(
    () => {
      const input = { date, dayTheme };
      return day ? updateDay(day.id, input) : createDay(warWeekId, input);
    },
    "Day saved",
    onSaved,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={day ? `Day ${day.date}` : "New Day"}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="gap-4 px-4">
        <Field data-invalid={!!fieldErrors.date}>
          <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
          <DatePicker
            id={`${id}-date`}
            name="date"
            required
            min={startDate}
            max={endDate}
            disabledDates={dayDateDisabled(
              startDate,
              endDate,
              dayDates,
              day?.date,
            )}
            aria-invalid={!!fieldErrors.date}
            value={date}
            onValueChange={setDate}
          />
          <FieldError>{fieldErrors.date}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.dayTheme}>
          <FieldLabel htmlFor={`${id}-theme`}>Day Theme</FieldLabel>
          <Input
            id={`${id}-theme`}
            name="dayTheme"
            required
            maxLength={120}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.dayTheme}
            value={dayTheme}
            onChange={(event) => setDayTheme(event.target.value)}
          />
          <FieldError>{fieldErrors.dayTheme}</FieldError>
        </Field>
      </FieldGroup>
      <SetupSheetFooter>
        <SetupSaveButton pending={pending} label={day ? "Save" : "Add Day"} />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}

/** The War Week's Days in date order, each with Edit and Delete, plus an Add button. */
export function DaysEditor({
  warWeekId,
  days,
  startDate,
  endDate,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  days: SetupDay[];
  startDate: string;
  endDate: string;
}) {
  const formProps = {
    warWeekId,
    dayDates: days.map((day) => day.date),
    startDate,
    endDate,
  };
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {days.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Days yet.</p>
      ) : (
        <ul aria-label="Days">
          {days.map((day) => (
            <SetupListRow
              key={day.id}
              id={day.id}
              name={formatDayHeading(day.date)}
              label={`Day ${day.date}`}
              details={[day.dayTheme, dayUsage(day)].join(" · ")}
              form={(close) => (
                <DayForm {...formProps} day={day} onSaved={close} />
              )}
              onDelete={() => deleteDay(day.id)}
              deleteTitle={`Delete the Day on ${day.date}?`}
              deleteDescription={dayUsage(day)}
              deleteSuccess="Day deleted"
            />
          ))}
        </ul>
      )}
      <SetupAddButton
        label="Add Day"
        form={(close) => <DayForm {...formProps} onSaved={close} />}
      />
    </div>
  );
}
