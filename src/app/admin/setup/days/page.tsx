import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { DaysEditor } from "@/components/days-editor";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import { formatDateRange } from "@/lib/war-week-display";
import { getSetupDays } from "@/queries/setup";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Days · JG War Week" };

export default async function SetupDaysPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/setup/days", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const days = await getSetupDays(warWeek);

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
        <h1 className="text-2xl font-bold">Days</h1>
        <p className="text-foreground/70 text-sm">
          Each Day falls within the War Week (
          {formatDateRange(warWeek.startDate, warWeek.endDate)}). A Day with
          Schedule Items can&apos;t be deleted.
        </p>
        <SeedOverwriteWarning />
        <DaysEditor
          warWeekId={warWeek.id}
          days={days}
          startDate={warWeek.startDate}
          endDate={warWeek.endDate}
        />
      </section>
    </AdminShell>
  );
}
