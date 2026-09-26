import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { ScheduleItemForm } from "@/components/schedule-item-form";
import { getSetupDays } from "@/queries/setup";
import { getCompetitionOptions } from "@/queries/setup-schedule-faq";

import { loadAdminPage } from "../../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New Schedule Item · JG War Week" };

export default async function NewScheduleItemPage() {
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage("/admin/setup/schedule/new");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [days, allCompetitions] = await Promise.all([
    getSetupDays(warWeek),
    getCompetitionOptions(warWeek),
  ]);
  // A Host links a new item to one of their own Competitions.
  const competitions = allCompetitions.filter((c) => runs(c.id));

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
          href="/admin/setup/schedule"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Schedule
        </Link>
        <h1 className="text-2xl font-bold">New Schedule Item</h1>
        {days.length === 0 ? (
          <p className="text-foreground/70 text-sm">
            Add a Day in{" "}
            <Link
              href="/admin/setup/days"
              className="text-primary underline-offset-4 hover:underline"
            >
              Days
            </Link>{" "}
            first.
          </p>
        ) : (
          <ScheduleItemForm
            warWeekId={warWeek.id}
            requireCompetition={!isOrganizer}
            days={days}
            competitions={competitions}
          />
        )}
      </section>
    </AdminShell>
  );
}
