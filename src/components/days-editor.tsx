"use client";

import { useId, useState } from "react";

import { createDay, deleteDay, updateDay } from "@/actions/setup";
import { DatePicker } from "@/components/date-picker";
import {
  SETUP_EDITOR,
  SetupRowButtons,
  SetupRowError,
  setupRowProps,
  usageSummary,
  useSetupRow,
} from "@/components/setup-row";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SetupDay } from "@/queries/setup";

/**
 * One Day's date and Day Theme, saved on its own. With no `day` it's the
 * "Add a Day" row. The server action checks the date and the Schedule Item
 * guard; its error is what's shown.
 */
function DayRow({
  day,
  startDate,
  endDate,
}: {
  day?: SetupDay;
  startDate: string;
  endDate: string;
}) {
  const id = useId();
  const [date, setDate] = useState(day?.date ?? "");
  const [dayTheme, setDayTheme] = useState(day?.dayTheme ?? "");
  const { pending, run, error } = useSetupRow(
    day
      ? undefined
      : () => {
          setDate("");
          setDayTheme("");
        },
  );
  const label = day ? `Day ${day.date}` : "New Day";
  const usage = day
    ? usageSummary([[day.scheduleItemCount, "Schedule Item", "Schedule Items"]])
    : "";

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { date, dayTheme };
    run(() => (day ? updateDay(day.id, input) : createDay(input)), "Day saved");
  }

  return (
    <li
      {...setupRowProps(day?.id)}
      className="border-border border-b py-3 last:border-b-0"
    >
      <form onSubmit={submit} aria-label={label}>
        <FieldGroup className="gap-2 sm:flex-row sm:items-end">
          <Field className="sm:w-auto">
            <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
            <DatePicker
              id={`${id}-date`}
              name="date"
              required
              min={startDate}
              max={endDate}
              value={date}
              onValueChange={setDate}
            />
          </Field>
          <Field className="sm:flex-1">
            <FieldLabel htmlFor={`${id}-theme`}>Day Theme</FieldLabel>
            <Input
              id={`${id}-theme`}
              name="dayTheme"
              required
              maxLength={120}
              className="h-11 sm:h-9"
              value={dayTheme}
              onChange={(event) => setDayTheme(event.target.value)}
            />
          </Field>
          <SetupRowButtons
            pending={pending}
            addLabel="Add Day"
            onDelete={
              day && (() => run(() => deleteDay(day.id), "Day deleted"))
            }
            deleteTitle={day && `Delete the Day on ${day.date}?`}
            deleteDescription={usage}
          />
        </FieldGroup>
      </form>
      {day && <p className="text-foreground/60 mt-1 text-xs">{usage}</p>}
      <SetupRowError error={error} />
    </li>
  );
}

/** The War Week's Days in date order, each editable, plus an add row. */
export function DaysEditor({
  days,
  startDate,
  endDate,
}: {
  days: SetupDay[];
  startDate: string;
  endDate: string;
}) {
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-6">
      {days.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Days yet.</p>
      ) : (
        <ul aria-label="Days">
          {days.map((day) => (
            // Keyed on the saved values so a refresh resets the row's fields.
            <DayRow
              key={`${day.id}-${day.date}-${day.dayTheme}`}
              day={day}
              startDate={startDate}
              endDate={endDate}
            />
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Add a Day</h2>
        <ul>
          <DayRow startDate={startDate} endDate={endDate} />
        </ul>
      </section>
    </div>
  );
}
