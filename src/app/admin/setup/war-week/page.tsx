import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import { WarWeekSettingsForm } from "@/components/war-week-settings-form";
import { normalizeHex } from "@/lib/color";
import { settingsInputFrom } from "@/lib/setup";
import { getSetupDays, getSetupTeams } from "@/queries/setup";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "War Week settings · JG War Week" };

export default async function WarWeekSettingsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/setup/war-week", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [days, teams] = await Promise.all([
    getSetupDays(warWeek),
    getSetupTeams(warWeek),
  ]);

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
        <h1 className="text-2xl font-bold">War Week settings</h1>
        <SeedOverwriteWarning />
        <WarWeekSettingsForm
          warWeekId={warWeek.id}
          key={warWeek.updatedAt.toISOString()}
          initial={settingsInputFrom(warWeek)}
          dayDates={days.map((day) => day.date)}
          teamSwatches={teams.flatMap((team) => {
            const color = normalizeHex(team.color);
            return color ? [{ color, label: team.name }] : [];
          })}
        />
      </section>
    </AdminShell>
  );
}
