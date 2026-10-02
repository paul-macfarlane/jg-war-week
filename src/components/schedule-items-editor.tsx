"use client";

import type { ReactNode } from "react";

import { deleteScheduleItem } from "@/actions/setup-schedule-faq";
import { ScheduleItemForm } from "@/components/schedule-item-form";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
} from "@/components/setup-row";
import { formatDayHeading } from "@/lib/schedule";
import type { ScheduleItemInput } from "@/lib/setup-schedule-faq";

/** One Schedule Item row: its title, a details line and its saved values. */
export type ScheduleItemRow = {
  id: string;
  title: string;
  /** The time range, category and Competition, rendered by the page. */
  details: ReactNode;
  initial: ScheduleItemInput;
};

/**
 * Each Day's Schedule Items in time order, as on the public Schedule, each
 * with Edit (the form in a Sheet) and Delete, then "Add Schedule Item".
 */
export function ScheduleItemsEditor({
  warWeekId,
  requireCompetition,
  days,
  competitions,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** A Host links each Schedule Item to a Competition they host. */
  requireCompetition: boolean;
  days: {
    id: string;
    date: string;
    dayTheme: string;
    items: ScheduleItemRow[];
  }[];
  /** The Competitions this viewer may link an item to. */
  competitions: { id: string; name: string }[];
}) {
  const formProps = {
    warWeekId,
    requireCompetition,
    days: days.map(({ id, date, dayTheme }) => ({ id, date, dayTheme })),
    competitions,
  };
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-6">
      <div aria-label="Schedule Items" className="flex flex-col gap-6">
        {days.map((day) => (
          <section key={day.id} className="flex flex-col gap-1">
            <h3 className="font-semibold">
              {formatDayHeading(day.date)}{" "}
              <span className="text-foreground/60 font-normal">
                · {day.dayTheme}
              </span>
            </h3>
            {day.items.length === 0 ? (
              <p className="text-foreground/60 text-sm">Nothing scheduled.</p>
            ) : (
              <ul>
                {day.items.map((item) => (
                  <SetupListRow
                    key={item.id}
                    id={item.id}
                    name={item.title}
                    details={item.details}
                    form={(close) => (
                      <ScheduleItemForm
                        {...formProps}
                        itemId={item.id}
                        initial={item.initial}
                        onSaved={close}
                      />
                    )}
                    onDelete={() => deleteScheduleItem(item.id)}
                    deleteTitle={`Delete "${item.title}"?`}
                    deleteSuccess="Schedule Item deleted"
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <SetupAddButton
        label="Add Schedule Item"
        form={(close) => <ScheduleItemForm {...formProps} onSaved={close} />}
      />
    </div>
  );
}
