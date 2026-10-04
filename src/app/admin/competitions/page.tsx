import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { CompetitionsEditor } from "@/components/competitions-editor";
import { getHostNames, getWarWeekCompetitionHosts } from "@/queries/organizers";
import { getSetupCompetitions } from "@/queries/setup";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Competitions · JG War Week" };

export default async function AdminCompetitionsPage() {
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage("/admin/competitions");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [allCompetitions, hosts] = await Promise.all([
    getSetupCompetitions(warWeek),
    // Host emails are shown only to Organizers.
    isOrganizer ? getWarWeekCompetitionHosts(warWeek.id) : undefined,
  ]);
  const hostNames = hosts ? await getHostNames(hosts) : undefined;
  const competitions = allCompetitions.filter((c) => runs(c.id));

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Competitions"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Competitions</h1>
        <p className="text-foreground/70 text-sm">
          Placement Points are the preset points for 1st, 2nd, 3rd…, highest
          first; a result earns them by place. A Competition with Points Entries
          or Schedule Items can&apos;t be deleted, and its scoring can&apos;t
          change while it has Points Entries.
        </p>
        <CompetitionsEditor
          warWeekId={warWeek.id}
          isOrganizer={isOrganizer}
          hosts={hosts}
          hostNames={hostNames}
          competitions={competitions}
          mode={warWeek.mode}
          teamLabel={warWeek.teamLabel}
        />
      </section>
    </AdminShell>
  );
}
