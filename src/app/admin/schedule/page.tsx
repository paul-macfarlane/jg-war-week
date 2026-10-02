import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { DaysEditor } from "@/components/days-editor";
import { CategoryBadge } from "@/components/schedule-item";
import { DeleteSetupItemButton } from "@/components/setup-schedule-faq-buttons";
import { buttonVariants } from "@/components/ui/button";
import { formatDayHeading, formatTimeRange } from "@/lib/schedule";
import { formatDateRange } from "@/lib/war-week-display";
import { getSchedule } from "@/queries/schedule";
import { getSetupDays } from "@/queries/setup";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Schedule · JG War Week" };

/**
 * The War Week's Days (with their Day Themes) and each Day's Schedule
 * Items on one page. An Organizer edits the Days; a Host sees only the
 * Schedule Items linked to their Competitions.
 */
export default async function AdminSchedulePage() {
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage("/admin/schedule");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [schedule, setupDays] = await Promise.all([
    getSchedule(warWeek.id),
    isOrganizer ? getSetupDays(warWeek) : [],
  ]);
  // The same grouping and order as the public Schedule page.
  const days = schedule.map((day) => ({
    ...day,
    items: day.items.filter((item) => runs(item.competition?.id)),
  }));

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Schedule"
    >
      <section className="flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold">Schedule</h1>
          {days.length > 0 && (
            <Link
              href="/admin/schedule/new"
              className={buttonVariants({ className: "ml-auto" })}
            >
              New Schedule Item
            </Link>
          )}
        </div>

        {isOrganizer && (
          <section
            aria-labelledby="days-heading"
            className="flex flex-col gap-2"
          >
            <h2 id="days-heading" className="text-lg font-semibold">
              Days
            </h2>
            <p className="text-foreground/70 text-sm">
              Each Day falls within the War Week (
              {formatDateRange(warWeek.startDate, warWeek.endDate)}) and has a
              Day Theme. A Day with Schedule Items can&apos;t be deleted.
            </p>
            <DaysEditor
              warWeekId={warWeek.id}
              days={setupDays}
              startDate={warWeek.startDate}
              endDate={warWeek.endDate}
            />
          </section>
        )}

        <section
          aria-labelledby="schedule-items-heading"
          className="flex flex-col gap-2"
        >
          <h2 id="schedule-items-heading" className="text-lg font-semibold">
            Schedule Items
          </h2>
          <p className="text-foreground/70 text-sm">
            Times are Eastern. Each Day&apos;s items are in time order, as on
            the public Schedule.
          </p>
          {days.length === 0 ? (
            <p className="text-foreground/70 text-sm">
              {isOrganizer
                ? "Add a Day above before adding Schedule Items."
                : "No Days yet. An Organizer adds the Days first."}
            </p>
          ) : (
            <div aria-label="Schedule Items" className="flex flex-col gap-6">
              {days.map((day) => (
                <section key={day.id} className="flex flex-col gap-2">
                  <h3 className="font-semibold">
                    {formatDayHeading(day.date)}{" "}
                    <span className="text-foreground/60 font-normal">
                      · {day.dayTheme}
                    </span>
                  </h3>
                  {day.items.length === 0 ? (
                    <p className="text-foreground/60 text-sm">
                      Nothing scheduled.
                    </p>
                  ) : (
                    <ul className="border-border divide-border divide-y rounded-lg border">
                      {day.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-foreground/70 text-xs tabular-nums">
                              {formatTimeRange(item)}
                            </span>
                            <span className="font-medium">{item.title}</span>
                            <span className="flex flex-wrap items-center gap-2 text-xs">
                              <CategoryBadge category={item.category} />
                              {item.competition && (
                                <span className="text-foreground/70">
                                  {item.competition.name}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/schedule/${item.id}`}
                              className={buttonVariants({
                                variant: "outline",
                                size: "xs",
                                className:
                                  "min-h-11 min-w-11 sm:min-h-6 sm:min-w-0",
                              })}
                            >
                              Edit
                            </Link>
                            <DeleteSetupItemButton
                              id={item.id}
                              name={item.title}
                              kind="schedule-item"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  );
}
