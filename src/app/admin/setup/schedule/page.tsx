import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { CategoryBadge } from "@/components/schedule-item";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import { DeleteSetupItemButton } from "@/components/setup-schedule-faq-buttons";
import { buttonVariants } from "@/components/ui/button";
import { formatDayHeading, formatTimeRange } from "@/lib/schedule";
import { getSchedule } from "@/queries/schedule";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Schedule · JG War Week" };

export default async function SetupSchedulePage() {
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage("/admin/setup/schedule");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  // The same grouping and order as the public Schedule page. A Host sees
  // only the items linked to their Competitions.
  const days = (await getSchedule(warWeek.id)).map((day) => ({
    ...day,
    items: day.items.filter((item) => runs(item.competition?.id)),
  }));

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Setup"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <Link
          href="/admin/setup"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Setup
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold">Schedule</h1>
          {days.length > 0 && (
            <Link
              href="/admin/setup/schedule/new"
              className={buttonVariants({ className: "ml-auto" })}
            >
              New Schedule Item
            </Link>
          )}
        </div>
        <p className="text-foreground/70 text-sm">
          Times are Eastern. Each Day&apos;s items are in time order, as on the
          public Schedule.
        </p>
        <SeedOverwriteWarning />

        {days.length === 0 ? (
          <p className="text-foreground/70 text-sm">
            No Days yet.{" "}
            {isOrganizer ? (
              <>
                <Link
                  href="/admin/setup/days"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Add a Day
                </Link>{" "}
                before adding Schedule Items.
              </>
            ) : (
              "An Organizer adds the Days first."
            )}
          </p>
        ) : (
          <div aria-label="Schedule Items" className="flex flex-col gap-6">
            {days.map((day) => (
              <section key={day.id} className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">
                  {formatDayHeading(day.date)}{" "}
                  <span className="text-foreground/60 font-normal">
                    · {day.dayTheme}
                  </span>
                </h2>
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
                            href={`/admin/setup/schedule/${item.id}`}
                            className="text-primary text-xs underline-offset-4 hover:underline"
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
    </AdminShell>
  );
}
