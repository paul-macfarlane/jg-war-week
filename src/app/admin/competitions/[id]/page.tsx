import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { CompetitionSettingsForm } from "@/components/competition-settings-form";
import { formatLabel } from "@/lib/bracket/view";
import { settingsValuesOf } from "@/lib/competition-page";
import { getBracketEntrants } from "@/queries/brackets";
import { getCompetitionPage } from "@/queries/competition-page";
import { getHostCandidates } from "@/queries/roster";
import { getCompetitionGroupSuggestions } from "@/queries/setup";

import { loadAdminPage } from "../../gate";
import { CompetitionRunArea, runAreaTitle } from "./run-area";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Competition · JG War Week" };

/**
 * A Competition's one admin page (ticket 101), for Organizers and that
 * Competition's Hosts; everyone else sees the refusal. **Settings** on top,
 * each autosaving through the per-field save and locked by the lock table;
 * the Format's **run area** below. The Hosts show as names (a Host) or in
 * a name-only picker (an Organizer): the page holds no roster email.
 */
export default async function CompetitionPage({
  params,
}: PageProps<"/admin/competitions/[id]">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/competitions/${id}`);
  if (!allowed || !runs(id)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }

  // The roster's candidates load for an Organizer only; they carry names
  // and a "Can't sign in" flag, never an email.
  const [page, groupSuggestions, hostCandidates] = await Promise.all([
    getCompetitionPage(warWeek.id, id),
    getCompetitionGroupSuggestions(warWeek),
    isOrganizer ? getHostCandidates(warWeek) : Promise.resolve([]),
  ]);
  if (!page) notFound();
  const { competition, facts, hostIds, hostNames } = page;
  const entrantCount =
    competition.format === "bracket" || competition.format === "league"
      ? (await getBracketEntrants(competition.id)).length
      : 0;

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Competitions"
    >
      <div className="flex max-w-3xl min-w-0 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link
              href="/admin/competitions"
              className="text-primary underline-offset-4 hover:underline"
            >
              ← Competitions
            </Link>
            <Link
              href={`/${warWeek.edition}/competitions/${competition.id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              Participant view
            </Link>
          </div>
          <h1 className="text-2xl font-bold">{competition.name}</h1>
          <p className="text-foreground/70 text-sm">
            {formatLabel(competition.format)}
          </p>
        </div>
        <CompetitionSettingsForm
          competitionId={competition.id}
          initial={settingsValuesOf({ ...competition, hosts: hostIds })}
          facts={facts}
          mode={warWeek.mode}
          teamLabel={warWeek.teamLabel}
          groupSuggestions={groupSuggestions}
          canAssignHosts={isOrganizer}
          hostNames={hostNames}
          hostCandidates={hostCandidates}
          entrantCount={entrantCount}
        />
        <section
          className="flex min-w-0 flex-col gap-4"
          aria-labelledby="competition-run-heading"
        >
          <h2 id="competition-run-heading" className="text-lg font-semibold">
            {runAreaTitle(competition.format)}
          </h2>
          <CompetitionRunArea
            warWeek={warWeek}
            competition={competition}
            facts={facts}
            email={email}
          />
        </section>
      </div>
    </AdminShell>
  );
}
