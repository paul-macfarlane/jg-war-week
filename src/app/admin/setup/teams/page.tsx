import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import { RosterEditor, TeamsEditor } from "@/components/teams-editor";
import { themeSwatches } from "@/lib/theme";
import {
  getCompanyTagSuggestions,
  getSetupParticipants,
  getSetupTeams,
} from "@/queries/setup";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Teams & roster · JG War Week" };

export default async function SetupTeamsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/setup/teams", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [teams, participants, tagSuggestions] = await Promise.all([
    getSetupTeams(warWeek),
    getSetupParticipants(warWeek),
    getCompanyTagSuggestions(),
  ]);
  const { teamLabel, leaderTitle } = warWeek;
  const isTeams = warWeek.mode === "teams";

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Setup"
    >
      <section className="flex max-w-5xl flex-col gap-4">
        <Link
          href="/admin/setup"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Setup
        </Link>
        <h1 className="text-2xl font-bold">
          {isTeams ? `${teamLabel}s & roster` : "Roster"}
        </h1>
        <p className="text-foreground/70 text-sm">
          A {isTeams ? `${teamLabel} or ` : ""}Participant with Points Entries
          or Awards can&apos;t be deleted.
          {isTeams && ` A ${teamLabel} with Participants can't be deleted.`}
        </p>
        <SeedOverwriteWarning />
        {isTeams ? (
          <section className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{teamLabel}s</h2>
            <TeamsEditor
              warWeekId={warWeek.id}
              teams={teams}
              teamLabel={teamLabel}
              themeSwatches={themeSwatches(warWeek)}
            />
          </section>
        ) : (
          <p className="text-foreground/70 text-sm">
            This War Week is a free-for-all, so it has no {teamLabel}s.
          </p>
        )}
        <section className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Roster</h2>
          <RosterEditor
            warWeekId={warWeek.id}
            participants={participants}
            teams={isTeams ? teams : []}
            teamLabel={teamLabel}
            leaderTitle={leaderTitle}
            tagSuggestions={tagSuggestions}
          />
        </section>
      </section>
    </AdminShell>
  );
}
