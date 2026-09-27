import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/auto-refresh";
import { BracketView } from "@/components/bracket-view";
import { CompetitionFacts, PointsEntryList } from "@/components/competitions";
import { getBracket, getParticipantTeamIds } from "@/queries/brackets";

import { getCompetitionPage } from "./competition";

export default async function CompetitionPage({
  params,
}: PageProps<"/[edition]/competitions/[id]">) {
  const { edition, id } = await params;
  // The layout already answered 404 for a missing one, above `loading.tsx`.
  const found = await getCompetitionPage(edition, id);
  if (!found) notFound();
  const { warWeek, competition, ledger } = found;
  const bracket = await getBracket(competition.id);
  const isBracket = bracket && bracket.competition.format !== "points";
  const participantTeams =
    isBracket && competition.scoring === "team"
      ? await getParticipantTeamIds(warWeek)
      : {};

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
      <Link
        href={`/${warWeek.edition}/competitions`}
        className="text-primary inline-flex items-center gap-1 text-sm font-medium"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Competitions
      </Link>
      <div className="flex flex-col gap-2">
        {competition.competitionGroup ? (
          <span className="text-foreground/60 text-sm">
            {competition.competitionGroup}
          </span>
        ) : null}
        <h1 className="text-2xl font-bold">{competition.name}</h1>
        <CompetitionFacts
          competition={competition}
          teamLabel={warWeek.teamLabel}
        />
      </div>
      {isBracket ? (
        <BracketView
          entrants={bracket.entrants}
          bracket={bracket.bracket}
          champion={bracket.champion}
          scoring={competition.scoring}
          primaryColor={warWeek.primaryColor}
          participantTeams={participantTeams}
        />
      ) : null}
      {competition.description ? (
        <p className="text-sm whitespace-pre-line">{competition.description}</p>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Points Entries</h2>
        <PointsEntryList entries={ledger.entries} />
      </section>
      <AutoRefresh />
    </main>
  );
}
