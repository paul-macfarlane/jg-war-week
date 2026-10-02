import { cn } from "cn";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ScheduleItemCard } from "@/components/schedule-item";
import { ScrollToToday } from "@/components/scroll-to-today";
import { buttonVariants } from "@/components/ui/button";
import {
  filterScheduleByDay,
  formatDayHeading,
  resolveClock,
  toEasternClock,
} from "@/lib/schedule";
import { getSchedule } from "@/queries/schedule";

import { getWarWeekForEdition } from "../war-week";

function dayAnchor(date: string) {
  return `day-${date}`;
}

export default async function SchedulePage({
  params,
  searchParams,
}: PageProps<"/[edition]/schedule">) {
  const { edition } = await params;
  const { at, day: dayParam } = await searchParams;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const allDays = await getSchedule(warWeek.id);
  const { selected, days } = filterScheduleByDay(allDays, dayParam);
  const today = toEasternClock(resolveClock(at, new Date())).date;
  const todayInWeek = days.some((day) => day.date === today);

  const dayHref = (date: string | undefined) => {
    const search = new URLSearchParams();
    if (typeof at === "string") search.set("at", at);
    if (date) search.set("day", date);
    const query = search.toString();
    return query ? `?${query}` : "";
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <span className="text-foreground/60 text-xs">All times ET</span>
      </div>
      {allDays.length > 1 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by day"
        >
          <Link
            href={dayHref(undefined)}
            aria-current={selected === null ? "true" : undefined}
            className={cn(
              buttonVariants({
                variant: selected === null ? "default" : "outline",
                size: "sm",
              }),
            )}
          >
            All
          </Link>
          {allDays.map((d) => (
            <Link
              key={d.id}
              href={dayHref(d.date)}
              aria-current={selected === d.date ? "true" : undefined}
              className={cn(
                buttonVariants({
                  variant: selected === d.date ? "default" : "outline",
                  size: "sm",
                }),
              )}
            >
              {formatDayHeading(d.date)}
            </Link>
          ))}
        </div>
      ) : null}
      {days.length === 0 ? (
        <p className="text-foreground/70 text-sm">No schedule yet.</p>
      ) : (
        days.map((day) => (
          <section
            key={day.id}
            id={dayAnchor(day.date)}
            className="flex scroll-mt-4 flex-col gap-3"
          >
            <div className="flex flex-col">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {formatDayHeading(day.date)}
                {day.date === today ? (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    Today
                  </span>
                ) : null}
              </h2>
              <p className="text-primary font-medium">{day.dayTheme}</p>
              {day.description ? (
                <p className="text-foreground/70 text-sm">{day.description}</p>
              ) : null}
            </div>
            {day.items.length === 0 ? (
              <p className="text-foreground/70 text-sm">Nothing scheduled.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {day.items.map((item) => (
                  <ScheduleItemCard
                    key={item.id}
                    item={item}
                    edition={warWeek.edition}
                  />
                ))}
              </ol>
            )}
          </section>
        ))
      )}
      {/* Only scroll to today in the All view, or when the filtered day is
          today — filtering to a different day shouldn't yank the viewer
          back to today's anchor. */}
      {todayInWeek && (selected === null || selected === today) ? (
        <ScrollToToday targetId={dayAnchor(today)} />
      ) : null}
    </main>
  );
}
