import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { PlacementSheet } from "@/components/placement-sheet";
import { setupHref, setupLinkLabel } from "@/lib/competitions";
import { getCompetitionWithLedger } from "@/queries/competitions";
import {
  getPlacementCandidates,
  getPlacementsView,
} from "@/queries/placements";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Placements · JG War Week" };

/**
 * A Placement Competition's sheet (`/admin/placements/[competitionId]`),
 * for Organizers and that Competition's Hosts; everyone else sees the
 * refusal. A Competition run another way points to its own setup.
 */
export default async function PlacementSheetPage({
  params,
}: PageProps<"/admin/placements/[competitionId]">) {
  const { competitionId } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/placements/${competitionId}`);
  if (!allowed || !runs(competitionId)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }

  const view = await getPlacementsView(competitionId);
  if (!view || view.competition.warWeekId !== warWeek.id) {
    const other = await getCompetitionWithLedger(warWeek, competitionId);
    if (!other) notFound();
    const { competition } = other;
    return (
      <AdminShell
        warWeek={warWeek}
        email={email}
        isOrganizer={isOrganizer}
        editions={editions}
        current="Competitions"
      >
        <section className="flex max-w-xl min-w-0 flex-col gap-4">
          <Link
            href="/admin/competitions"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            ← Competitions
          </Link>
          <h1 className="text-2xl font-bold">{competition.name}</h1>
          <p className="text-foreground/70 text-sm">
            This Competition isn&apos;t run as Placement.{" "}
            <Link
              href={setupHref(competition.format, competition.id)}
              className="text-primary underline-offset-4 hover:underline"
            >
              {setupLinkLabel(competition.format)}
            </Link>
            .
          </p>
        </section>
      </AdminShell>
    );
  }
  const { competition, rows } = view;
  const candidates = await getPlacementCandidates(warWeek, competition);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Competitions"
    >
      <section className="flex max-w-3xl min-w-0 flex-col gap-4">
        <PlacementSheet
          competition={{
            id: competition.id,
            name: competition.name,
            scoring: competition.scoring,
            countsTowardTeam: competition.countsTowardTeam,
            placementPoints: competition.placementPoints,
            scoreDirection: competition.scoreDirection,
            finalized: competition.finalizedAt !== null,
          }}
          rows={rows.map(({ id, name, team, place, score }) => ({
            id,
            name,
            team,
            place,
            score,
          }))}
          candidates={candidates}
          teamLabel={warWeek.teamLabel}
          edition={warWeek.edition}
        />
      </section>
    </AdminShell>
  );
}
