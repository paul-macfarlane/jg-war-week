import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getActor } from "@/auth/actor";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  BracketView,
  type BracketViewSelfReport,
} from "@/components/bracket-view";
import { CompetitionFacts, PointsEntryList } from "@/components/competitions";
import { can } from "@/lib/access";
import { entrantForYou, nextHeatFor } from "@/lib/bracket/view";
import { resolveYou } from "@/lib/you";
import {
  type BracketView as BracketData,
  getBracket,
  getParticipantSquadIds,
  getParticipantTeamIds,
} from "@/queries/brackets";
import { getHeatReportFacts } from "@/queries/heat-reports";
import { getYouCandidates } from "@/queries/roster";
import { getSetupDays } from "@/queries/setup";

import { getCompetitionPage } from "./competition";

const SELF_REPORT_OFF: BracketViewSelfReport = {
  on: false,
  linkedParticipantId: null,
  reportableHeatId: null,
};

/**
 * Whether the signed-in person may report their next Heat (ADR 0005): the
 * Participant their session email links to (as the layout finds them;
 * never the "Which one is you?" pick), and Your next Heat when the same
 * `can` rule the report action runs lets them report it now.
 */
async function selfReportFor(
  warWeek: { id: string },
  view: BracketData,
  participantTeams: Record<string, string>,
  participantSquads: Record<string, string>,
): Promise<BracketViewSelfReport> {
  const { competition } = view;
  if (!competition.selfReport) return SELF_REPORT_OFF;
  const [actor, candidates] = await Promise.all([
    getActor(),
    getYouCandidates(warWeek),
  ]);
  const linked = resolveYou({
    sessionEmail: actor?.email,
    participants: candidates,
    storedId: null,
  });
  if (!actor || !linked) {
    return { on: true, linkedParticipantId: null, reportableHeatId: null };
  }
  const youEntrantId = entrantForYou(
    view.entrants,
    {
      participantId: linked.participantId,
      teamId: participantTeams[linked.participantId] ?? null,
      squadId: participantSquads[linked.participantId] ?? null,
    },
    competition.scoring,
  );
  const next = youEntrantId ? nextHeatFor(view.bracket, youEntrantId) : null;
  let reportableHeatId: string | null = null;
  if (next?.kind === "heat") {
    const facts = await getHeatReportFacts(
      competition.id,
      next.heat.id,
      actor.email,
    );
    const refusal = can(actor, "bracket.heat-report", {
      warWeekId: competition.warWeekId,
      competitionId: competition.id,
      heatReport: facts.heatReport,
    });
    if (!refusal) reportableHeatId = next.heat.id;
  }
  return {
    on: true,
    linkedParticipantId: linked.participantId,
    reportableHeatId,
  };
}

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
  const [participantTeams, participantSquads, days] = isBracket
    ? await Promise.all([
        competition.scoring === "team"
          ? getParticipantTeamIds(warWeek)
          : Promise.resolve({}),
        getParticipantSquadIds(competition.id),
        getSetupDays(warWeek),
      ])
    : [{}, {}, []];
  const selfReport = isBracket
    ? await selfReportFor(warWeek, bracket, participantTeams, participantSquads)
    : SELF_REPORT_OFF;

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
          competitionId={competition.id}
          entrants={bracket.entrants}
          bracket={bracket.bracket}
          champion={bracket.champion}
          scoring={competition.scoring}
          primaryColor={warWeek.primaryColor}
          participantTeams={participantTeams}
          participantSquads={participantSquads}
          days={days}
          finaleHref={
            bracket.finalized
              ? `/${warWeek.edition}/finale/${competition.id}`
              : null
          }
          selfReport={selfReport}
        />
      ) : null}
      {competition.description ? (
        <p className="text-sm whitespace-pre-line">{competition.description}</p>
      ) : null}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Points Entries</h2>
        <PointsEntryList entries={ledger.entries} />
      </section>
      {/* A Bracket's view refreshes itself, pausing while a report is open. */}
      {isBracket ? null : <AutoRefresh />}
    </main>
  );
}
