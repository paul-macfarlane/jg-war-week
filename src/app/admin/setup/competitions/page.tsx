import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { CompetitionsEditor } from "@/components/competitions-editor";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import { getWarWeekCompetitionHosts } from "@/queries/organizers";
import {
  getCompetitionGroupSuggestions,
  getSetupCompetitions,
} from "@/queries/setup";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Competitions · JG War Week" };

export default async function SetupCompetitionsPage() {
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage("/admin/setup/competitions");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [allCompetitions, groupSuggestions, hosts] = await Promise.all([
    getSetupCompetitions(warWeek),
    getCompetitionGroupSuggestions(warWeek),
    // Host emails are shown only to Organizers.
    isOrganizer ? getWarWeekCompetitionHosts(warWeek.id) : undefined,
  ]);
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
          href="/admin/setup"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Setup
        </Link>
        <h1 className="text-2xl font-bold">Competitions</h1>
        <p className="text-foreground/70 text-sm">
          Placement Points are the preset points for 1st, 2nd, 3rd…, highest
          first; they show as buttons in points entry. A Competition with Points
          Entries or Schedule Items can&apos;t be deleted, and its scoring
          can&apos;t change while it has Points Entries.
        </p>
        <SeedOverwriteWarning />
        <CompetitionsEditor
          warWeekId={warWeek.id}
          isOrganizer={isOrganizer}
          hosts={hosts}
          competitions={competitions}
          groupSuggestions={groupSuggestions}
          mode={warWeek.mode}
          teamLabel={warWeek.teamLabel}
        />
      </section>
    </AdminShell>
  );
}
