import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { NextWarWeekForm } from "@/components/next-war-week-form";
import { nextEditionDefaults } from "@/lib/war-week-lifecycle";
import { getWarWeeks } from "@/queries/war-weeks";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create next War Week · JG War Week",
};

export default async function NextWarWeekPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/setup/next", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const existing = await getWarWeeks();

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
        <h1 className="text-2xl font-bold">Create next War Week</h1>
        <p className="text-foreground/70">
          It starts upcoming, so the current War Week stays current until you
          start the new one.
        </p>
        <NextWarWeekForm
          fromWarWeekId={warWeek.id}
          fromEdition={warWeek.edition}
          defaults={nextEditionDefaults(existing, new Date().getFullYear())}
        />
      </section>
    </AdminShell>
  );
}
