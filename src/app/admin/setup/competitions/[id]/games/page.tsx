import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { GamesBuilder } from "@/components/games-builder";
import { getBracketEntrants } from "@/queries/brackets";
import { getGamesView } from "@/queries/games";
import { getPointsEntryFormOptions } from "@/queries/points-entries";

import { loadAdminPage } from "../../../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Games · JG War Week" };

export default async function GamesBuilderPage({
  params,
}: PageProps<"/admin/setup/competitions/[id]/games">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/setup/competitions/${id}/games`);
  if (!allowed || !runs(id)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }

  const [view, options, entrants] = await Promise.all([
    getGamesView(id, email),
    getPointsEntryFormOptions(warWeek),
    getBracketEntrants(id),
  ]);
  if (!view || view.competition.warWeekId !== warWeek.id) notFound();
  const { competition } = view;

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Setup"
    >
      <section className="flex max-w-3xl min-w-0 flex-col gap-4">
        <Link
          href="/admin/setup/competitions"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Competitions
        </Link>
        <GamesBuilder
          competition={{
            id: competition.id,
            name: competition.name,
            scoring: competition.scoring,
            gameType: competition.gameType,
            config: competition.config,
            entrantsOpen: competition.entrantsOpen,
            loggingClosesAt: competition.loggingClosesAt,
            closed: competition.closed,
            placementPoints: competition.placementPoints,
            bestOfDecided: view.bestOfDecided,
            bestOfWinner: view.bestOfWinner,
          }}
          entrants={entrants.map(({ teamId, participantId }) => ({
            teamId,
            participantId,
          }))}
          teams={options.teams}
          participants={options.participants}
          enroll={{
            selfEnroll: competition.selfEnroll,
            entrantLimit: competition.entrantLimit,
            enrollClosesAt: competition.enrollClosesAt,
          }}
        />
      </section>
    </AdminShell>
  );
}
