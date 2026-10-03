import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { ParticipationBuilder } from "@/components/participation-builder";
import { getParticipationView } from "@/queries/participation";
import { getPointsEntryFormOptions } from "@/queries/points-entries";

import { loadAdminPage } from "../../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Participation · JG War Week" };

export default async function ParticipationBuilderPage({
  params,
}: PageProps<"/admin/competitions/[id]/participation">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/competitions/${id}/participation`);
  if (!allowed || !runs(id)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }

  const [view, options] = await Promise.all([
    getParticipationView(id),
    getPointsEntryFormOptions(warWeek),
  ]);
  if (!view || view.competition.warWeekId !== warWeek.id) notFound();
  const { competition } = view;

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Competitions"
    >
      <section className="flex max-w-3xl min-w-0 flex-col gap-4">
        <Link
          href="/admin/competitions"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Competitions
        </Link>
        <ParticipationBuilder
          competition={{
            id: competition.id,
            name: competition.name,
            scoring: competition.scoring,
            participationPoints: competition.participationPoints,
            placementPoints: competition.placementPoints,
            selfCheckIn: competition.selfCheckIn,
            checkInClosesAt: competition.checkInClosesAt,
            closed: competition.closed,
          }}
          roster={options.participants.map(({ id, name, team }) => ({
            id,
            name,
            team,
          }))}
          tookPart={view.tookPart.map(({ participantId, checkedIn }) => ({
            participantId,
            checkedIn,
          }))}
          teamCounts={view.teamCounts.map(({ teamId, name, count, place }) => ({
            teamId,
            name,
            count,
            place,
          }))}
          teamLabel={warWeek.teamLabel}
        />
      </section>
    </AdminShell>
  );
}
