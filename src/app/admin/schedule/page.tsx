import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { DaysEditor } from "@/components/days-editor";
import { CategoryBadge } from "@/components/schedule-item";
import { ScheduleItemsEditor } from "@/components/schedule-items-editor";
import { buildParticipantOptions } from "@/lib/participant-options";
import { sanitizeContent } from "@/lib/rich-text/content";
import { formatTimeRange } from "@/lib/schedule";
import { scheduleItemInputFrom } from "@/lib/setup-schedule-faq";
import { formatDateRange } from "@/lib/war-week-display";
import { getHostCandidates } from "@/queries/roster";
import { getSchedule, getScheduleItemHostIds } from "@/queries/schedule";
import { getSetupDays } from "@/queries/setup";
import { getCompetitionOptions } from "@/queries/setup-schedule-faq";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Schedule · JG War Week" };

/**
 * The War Week's Days (with their Day Themes) and each Day's Schedule
 * Items on one page, each row with Edit (a Sheet) and Delete. Organizers only.
 */
export default async function AdminSchedulePage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/schedule", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [schedule, hostIds, setupDays, competitions, candidates] =
    await Promise.all([
      getSchedule(warWeek.id),
      getScheduleItemHostIds(warWeek.id),
      getSetupDays(warWeek),
      getCompetitionOptions(warWeek),
      getHostCandidates(warWeek),
    ]);
  // Names and Avatars only: the roster email never reaches the page.
  const hostOptions = buildParticipantOptions(
    candidates.map(({ id, name, image, teamName, teamColor }) => ({
      id,
      name,
      image,
      teamName,
      teamColor,
    })),
  );
  // The same grouping and order as the public Schedule page.
  const days = schedule.map((day) => ({
    id: day.id,
    date: day.date,
    dayTheme: day.dayTheme,
    items: day.items.map((item) => {
      // Sanitized on write; again here so the editor only gets the
      // closed set.
      const description = item.description && sanitizeContent(item.description);
      return {
        id: item.id,
        title: item.title,
        details: (
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{formatTimeRange(item)}</span>
            <CategoryBadge category={item.category} />
            {item.competition && <span>{item.competition.name}</span>}
          </span>
        ),
        initial: scheduleItemInputFrom({
          ...item,
          dayId: day.id,
          competitionId: item.competition?.id ?? null,
          hostIds: hostIds.get(item.id) ?? [],
          description: description?.ok ? description.content : null,
        }),
      };
    }),
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
        <h1 className="text-2xl font-bold">Schedule</h1>

        <section aria-labelledby="days-heading" className="flex flex-col gap-2">
          <h2 id="days-heading" className="text-lg font-semibold">
            Days
          </h2>
          <p className="text-foreground/70 text-sm">
            Each Day falls within the War Week (
            {formatDateRange(warWeek.startDate, warWeek.endDate)}) and has a Day
            Theme. A Day with Schedule Items can&apos;t be deleted.
          </p>
          <DaysEditor
            warWeekId={warWeek.id}
            days={setupDays}
            startDate={warWeek.startDate}
            endDate={warWeek.endDate}
          />
        </section>

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
              Add a Day above before adding Schedule Items.
            </p>
          ) : (
            <ScheduleItemsEditor
              warWeekId={warWeek.id}
              days={days}
              competitions={competitions}
              hostOptions={hostOptions}
            />
          )}
        </section>
      </section>
    </AdminShell>
  );
}
