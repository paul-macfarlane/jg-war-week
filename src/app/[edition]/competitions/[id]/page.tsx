import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getActor } from "@/auth/actor";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  BracketView,
  type BracketViewSelfReport,
} from "@/components/bracket-view";
import { CollapsibleDescription } from "@/components/collapsible-description";
import { CompetitionFacts } from "@/components/competitions";
import { EnrollButton } from "@/components/enroll-button";
import { LeagueView } from "@/components/league-view";
import { LoggedResults } from "@/components/logged-results-view";
import { ParticipationView } from "@/components/participation-view";
import { PlacementView } from "@/components/placement-view";
import { RichText } from "@/components/rich-text";
import { buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { can } from "@/lib/access";
import { podiumOf } from "@/lib/bracket/podium";
import { resultLockReason } from "@/lib/bracket/self-report";
import { entrantForYou } from "@/lib/bracket/view";
import { isLoggedFormat } from "@/lib/enums";
import { resolveYou } from "@/lib/you";
import {
  type BracketView as BracketData,
  getBracket,
  getParticipantSquadIds,
  getParticipantTeamIds,
} from "@/queries/brackets";
import { getLeagueView } from "@/queries/league";
import { getLoggedResultsView } from "@/queries/logged-results";
import { getMatchReportFacts } from "@/queries/match-reports";
import { getParticipationView } from "@/queries/participation";
import { getPlacementsView } from "@/queries/placements";
import { getYouCandidates } from "@/queries/roster";

import { checkInOfferFor } from "./check-in";
import { getCompetitionPage } from "./competition";
import { enrollOfferFor } from "./enrollment";

const SELF_REPORT_OFF: BracketViewSelfReport = {
  on: false,
  linkedParticipantId: null,
  reportableMatchIds: [],
  lockedMatchIds: [],
};

/**
 * Which Matches the signed-in person may record or change (spec R21,
 * decision 4; D1c, D1d): with self-report on and the Bracket open, the
 * Matches their Entrant plays that the same `can` rule the report action
 * runs lets them record now, and those whose result a later Match already
 * used (shown disabled, with the reason).
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
  });
  if (!actor || !linked || view.closed) {
    return {
      ...SELF_REPORT_OFF,
      on: true,
      linkedParticipantId: linked?.participantId ?? null,
    };
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
  const played = youEntrantId
    ? view.bracket.matches.filter((m) =>
        m.slots.some((s) => s.entrantId === youEntrantId),
      )
    : [];
  const reportableMatchIds: string[] = [];
  const lockedMatchIds: string[] = [];
  for (const match of played) {
    const facts = await getMatchReportFacts(
      competition.id,
      match.id,
      actor.email,
    );
    const refusal = can(actor, "bracket.match-report", {
      warWeekId: competition.warWeekId,
      competitionId: competition.id,
      matchReport: facts.matchReport,
    });
    if (!refusal) reportableMatchIds.push(match.id);
    else if (resultLockReason(view.bracket, match)) {
      lockedMatchIds.push(match.id);
    }
  }
  return {
    on: true,
    linkedParticipantId: linked.participantId,
    reportableMatchIds,
    lockedMatchIds,
  };
}

export default async function CompetitionPage({
  params,
  searchParams,
}: PageProps<"/[edition]/competitions/[id]">) {
  const { edition, id } = await params;
  const { log } = await searchParams;
  // The layout already answered 404 for a missing one, above `loading.tsx`.
  const found = await getCompetitionPage(edition, id);
  if (!found) notFound();
  const { warWeek, competition } = found;
  // `getBracket` loads nothing for a League: it has its own view.
  const bracket = await getBracket(competition.id);
  const isBracket = bracket && bracket.competition.format !== "placement";
  const [participantTeams, participantSquads] = isBracket
    ? await Promise.all([
        competition.scoring === "team"
          ? getParticipantTeamIds(warWeek)
          : Promise.resolve({}),
        getParticipantSquadIds(competition.id),
      ])
    : [{}, {}];
  const selfReport = isBracket
    ? await selfReportFor(warWeek, bracket, participantTeams, participantSquads)
    : SELF_REPORT_OFF;
  const isLogged = isLoggedFormat(competition.format);
  const isParticipation = competition.format === "participation";
  const isPlacement = competition.format === "placement";
  const isLeague = competition.format === "league";
  // The viewer's email stays on the server: the page gets names, ids and
  // booleans computed from it (R3 decision 17).
  const actor = await getActor();
  const email = actor?.email ?? null;
  // Manage shows to whoever the admin Competition page lets in: the same
  // `can` rule, decided here so the client gets only a boolean.
  const canManage =
    can(actor, "competition.edit", {
      warWeekId: warWeek.id,
      competitionId: competition.id,
    }) === null;
  const [logged, enrollOffer, participation, checkInOffer, placements, league] =
    await Promise.all([
      isLogged
        ? getLoggedResultsView(competition.id, email)
        : Promise.resolve(null),
      isBracket || isLeague
        ? enrollOfferFor(competition, email)
        : Promise.resolve(null),
      isParticipation
        ? getParticipationView(competition.id)
        : Promise.resolve(undefined),
      isParticipation
        ? checkInOfferFor(competition.id, email)
        : Promise.resolve(null),
      isPlacement
        ? getPlacementsView(competition.id)
        : Promise.resolve(undefined),
      isLeague ? getLeagueView(competition.id, email) : Promise.resolve(null),
    ]);

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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-2xl font-bold">{competition.name}</h1>
          {canManage ? (
            // A plain link, never prefetched: the route switches the admin
            // edition to this War Week, then opens the admin page.
            <a
              href={`/${warWeek.edition}/competitions/${competition.id}/manage`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Manage
            </a>
          ) : null}
        </div>
        <CompetitionFacts
          competition={competition}
          teamLabel={warWeek.teamLabel}
          mode={warWeek.mode}
        />
      </div>
      {competition.description ? (
        <CollapsibleDescription>
          <RichText content={competition.description} headingFloor={3} />
        </CollapsibleDescription>
      ) : null}
      {enrollOffer ? <EnrollButton offer={enrollOffer} /> : null}
      {logged ? (
        <LoggedResults
          competitionId={competition.id}
          format={logged.competition.format}
          config={logged.competition.config}
          scoring={logged.competition.scoring}
          closed={logged.competition.closed}
          leaderboard={logged.leaderboard}
          results={logged.results}
          linked={logged.linked}
          runs={logged.runs}
          viewerCanLog={logged.viewerCanLog}
          logOffer={logged.logOffer}
          scoringConfig={logged.competition.scoringConfig}
          maxAttempts={logged.competition.maxAttempts}
          attemptCounts={logged.attemptCounts}
          decided={logged.decided}
          seriesWinner={logged.seriesWinner}
          playerOptions={logged.playerOptions}
          primaryColor={warWeek.primaryColor}
          teamLabel={warWeek.teamLabel}
          now={new Date()}
          openLog={log === "1"}
        />
      ) : null}
      {participation ? (
        <ParticipationView
          view={participation}
          offer={checkInOffer}
          teamLabel={warWeek.teamLabel}
          primaryColor={warWeek.primaryColor}
        />
      ) : null}
      {placements ? (
        <PlacementView
          view={placements}
          primaryColor={warWeek.primaryColor}
          teamLabel={warWeek.teamLabel}
        />
      ) : null}
      {league ? (
        <LeagueView
          view={league}
          primaryColor={warWeek.primaryColor}
          teamLabel={warWeek.teamLabel}
          now={new Date()}
        />
      ) : null}
      {isBracket ? (
        <BracketView
          competitionId={competition.id}
          entrants={bracket.entrants}
          bracket={bracket.bracket}
          podium={podiumOf(bracket)}
          closed={bracket.closed}
          scoring={competition.scoring}
          scoreUnit={bracket.competition.scoreUnit}
          scoreDirection={bracket.competition.scoreDirection}
          primaryColor={warWeek.primaryColor}
          participantTeams={participantTeams}
          participantSquads={participantSquads}
          selfReport={selfReport}
        />
      ) : null}
      {/* A Bracket's view refreshes itself, pausing while a report is open. */}
      {isBracket ? null : <AutoRefresh />}
      {/* Results and refusals toast here, as on the admin screens. */}
      {isBracket || isLogged || league || enrollOffer || checkInOffer ? (
        <Toaster position="bottom-center" closeButton />
      ) : null}
    </main>
  );
}
