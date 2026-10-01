import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { BracketResults } from "@/components/bracket-results";
import { getBracket, getHeatReporters } from "@/queries/brackets";
import { getGamesCompetitions } from "@/queries/games";
import { getSetupDays } from "@/queries/setup";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bracket results · JG War Week" };

export default async function BracketResultsPage({
  params,
}: PageProps<"/admin/brackets/[id]">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/brackets/${id}`);
  if (!allowed || !runs(id)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }

  const [view, days, games] = await Promise.all([
    getBracket(id),
    getSetupDays(warWeek),
    getGamesCompetitions(warWeek),
  ]);
  // A `games` Competition is never a Bracket: point to its Games setup.
  const runAsGames = games.find((competition) => competition.id === id);
  if (runAsGames) {
    return (
      <AdminShell
        warWeek={warWeek}
        email={email}
        isOrganizer={isOrganizer}
        editions={editions}
        current="Points Entries"
      >
        <section className="flex max-w-xl min-w-0 flex-col gap-4">
          <Link
            href="/admin/points"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            ← Points Entries
          </Link>
          <h1 className="text-2xl font-bold">{runAsGames.name}</h1>
          <p className="text-foreground/70 text-sm">
            This Competition is run as Games, not a Bracket.{" "}
            <Link
              href={`/admin/setup/competitions/${runAsGames.id}/games`}
              className="text-primary underline-offset-4 hover:underline"
            >
              Open its Games
            </Link>
            .
          </p>
        </section>
      </AdminShell>
    );
  }
  if (!view || view.competition.warWeekId !== warWeek.id) notFound();
  // After the 404: the id is a Competition's now, so it's a well-formed uuid.
  const reporters = await getHeatReporters(id);
  const { competition } = view;

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Points Entries"
    >
      <section className="flex max-w-xl min-w-0 flex-col gap-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/admin/points"
            className="text-primary underline-offset-4 hover:underline"
          >
            ← Points Entries
          </Link>
          <Link
            href={`/admin/setup/competitions/${competition.id}/bracket`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Builder
          </Link>
          <Link
            href={`/${warWeek.edition}/competitions/${competition.id}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Participant view
          </Link>
        </div>
        <h1 className="text-2xl font-bold">{competition.name} · Results</h1>
        {competition.format === "points" ? (
          <p className="text-foreground/70 text-sm">
            This Competition isn&apos;t run as a Bracket. Set its Format in the
            builder.
          </p>
        ) : (
          <BracketResults
            competitionId={competition.id}
            placementPoints={competition.placementPoints}
            scoring={competition.scoring}
            entrants={view.entrants}
            bracket={view.bracket}
            champion={view.champion}
            finalized={view.finalized}
            primaryColor={warWeek.primaryColor}
            days={days}
            reporters={reporters}
            finaleHref={
              view.finalized
                ? `/${warWeek.edition}/finale/${competition.id}`
                : null
            }
          />
        )}
      </section>
    </AdminShell>
  );
}
