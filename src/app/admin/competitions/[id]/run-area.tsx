import { AdminLoggedResults } from "@/components/admin-logged-results";
import { BracketAdmin } from "@/components/bracket-admin";
import { BracketBuilder } from "@/components/bracket-builder";
import { LeagueBuilder } from "@/components/league-builder";
import { LeagueRounds } from "@/components/league-rounds";
import { LoggedResultsBuilder } from "@/components/logged-results-builder";
import { ParticipationBuilder } from "@/components/participation-builder";
import { PlacementSheet } from "@/components/placement-sheet";
import type { Competition, WarWeek } from "@/db/schema";
import { podiumOf } from "@/lib/bracket/podium";
import {
  type CompetitionLockFacts,
  settingLockReason,
} from "@/lib/competition-locks";
import { isLoggedFormat } from "@/lib/enums";
import { resultNoun } from "@/lib/logged-results";
import {
  getBracket,
  getBracketEntrants,
  getMatchReporters,
  getSquads,
} from "@/queries/brackets";
import { getLeagueView } from "@/queries/league";
import { getLoggedResultsView } from "@/queries/logged-results";
import { getParticipationView } from "@/queries/participation";
import {
  getPlacementCandidates,
  getPlacementsView,
} from "@/queries/placements";
import { getTargetOptions } from "@/queries/target-options";

/** The run area's heading, by Format. */
export function runAreaTitle(format: Competition["format"]): string {
  if (format === "placement") return "Record placements";
  if (format === "participation") return "Who took part";
  if (format === "league") return "Entrants and rounds";
  if (format === "best-score") return resultNoun(format).many;
  if (isLoggedFormat(format)) return `Entrants and ${resultNoun(format).many}`;
  return "Entrants and Bracket";
}

/**
 * The Format's run area on the Competition page (ticket 101), below the
 * Settings: Record placements (Placement); the Entrants and the Bracket
 * tree with Close (Bracket); the two Entrants and Close (Head-to-head);
 * the Attempts and Close (Best score); who took part and Close
 * (Participation); the Entrants, rounds and Close (League). Each loads its own
 * data; a write that the lock table covers (Entrants, building the
 * Bracket) goes through the per-field save. Names only, never an email.
 */
export async function CompetitionRunArea({
  warWeek,
  competition,
  facts,
  email,
}: {
  warWeek: WarWeek;
  competition: Competition;
  facts: CompetitionLockFacts;
  /** The viewer, for the results' "Mine". */
  email: string;
}) {
  const id = competition.id;
  const entrantsLock = settingLockReason("entrants", facts);

  if (competition.format === "placement") {
    const view = await getPlacementsView(id);
    if (!view) return null;
    const candidates = await getPlacementCandidates(warWeek, view.competition);
    return (
      <PlacementSheet
        competition={{
          id,
          scoring: view.competition.scoring,
          placementPoints: view.competition.placementPoints,
          scoreDirection: view.competition.scoreDirection,
          scoreUnit: view.competition.scoreUnit,
          closed: view.competition.closedAt !== null,
        }}
        rows={view.rows.map(({ id: rowId, name, team, place, score }) => ({
          id: rowId,
          name,
          team,
          place,
          score,
        }))}
        candidates={candidates}
        teamLabel={warWeek.teamLabel}
      />
    );
  }

  if (competition.format === "participation") {
    const [view, options] = await Promise.all([
      getParticipationView(id),
      getTargetOptions(warWeek),
    ]);
    if (!view) return null;
    return (
      <ParticipationBuilder
        competition={{
          id,
          scoring: view.competition.scoring,
          participationPoints: view.competition.participationPoints,
          placementPoints: view.competition.placementPoints,
          closed: view.competition.closed,
        }}
        roster={options.participants.map(
          ({ id: pid, name, team, teamColor, image }) => ({
            id: pid,
            name,
            team,
            teamColor,
            image,
          }),
        )}
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
    );
  }

  if (isLoggedFormat(competition.format)) {
    const [view, options, entrants] = await Promise.all([
      getLoggedResultsView(id, email),
      getTargetOptions(warWeek),
      getBracketEntrants(id),
    ]);
    if (!view) return null;
    return (
      <div className="flex flex-col gap-10">
        <LoggedResultsBuilder
          competition={{
            id,
            scoring: view.competition.scoring,
            format: view.competition.format,
            closed: view.competition.closed,
            placementPoints: view.competition.placementPoints,
            decided: view.decided,
            seriesWinner: view.seriesWinner,
            closeError: view.closeError,
          }}
          entrants={entrants.map(({ teamId, participantId }) => ({
            teamId,
            participantId,
          }))}
          teams={options.teams}
          participants={options.participants}
          entrantsLock={entrantsLock}
        />
        <AdminLoggedResults
          competitionId={id}
          format={view.competition.format}
          config={view.competition.config}
          scoring={view.competition.scoring}
          closed={view.competition.closed}
          viewerCanLog={view.viewerCanLog}
          logOffer={view.logOffer}
          scoringConfig={view.competition.scoringConfig}
          maxAttempts={view.competition.maxAttempts}
          attemptCounts={view.attemptCounts}
          leaderboard={view.leaderboard}
          results={view.results}
          playerOptions={view.playerOptions}
          primaryColor={warWeek.primaryColor}
          teamLabel={warWeek.teamLabel}
          now={new Date()}
        />
      </div>
    );
  }

  if (competition.format === "league") {
    const [view, options] = await Promise.all([
      getLeagueView(id, email),
      getTargetOptions(warWeek),
    ]);
    if (!view) return null;
    return (
      <div className="flex flex-col gap-10">
        <LeagueBuilder
          competition={{
            id,
            scoring: view.competition.scoring,
            closed: view.competition.closed,
            placementPoints: view.competition.placementPoints,
          }}
          entrants={view.entrants.map(({ teamId, participantId }) => ({
            teamId,
            participantId,
          }))}
          offers={view.offers}
          roundsPaired={view.roundsPaired}
          roundsTotal={view.roundsTotal}
          teams={options.teams}
          participants={options.participants}
          entrantsLock={entrantsLock}
          teamLabel={warWeek.teamLabel}
        />
        {view.rounds.length > 0 && (
          <LeagueRounds
            competitionId={id}
            scoring={view.competition.scoring}
            pairing={view.competition.config.pairing}
            scoreDirection={view.competition.scoreDirection}
            scoreUnit={view.competition.scoreUnit}
            entrants={view.entrants}
            rounds={view.rounds}
            runs={view.runs}
            linked={view.linked}
            now={new Date()}
          />
        )}
      </div>
    );
  }

  const [view, options, squads, reporters] = await Promise.all([
    getBracket(id),
    getTargetOptions(warWeek),
    getSquads(id),
    getMatchReporters(id),
  ]);
  if (!view) return null;
  return (
    <div className="flex flex-col gap-10">
      <BracketBuilder
        competition={{
          id,
          name: competition.name,
          scoring: competition.scoring,
        }}
        entrants={view.entrants}
        bracket={view.bracket}
        teams={options.teams}
        participants={options.participants}
        squads={squads}
        teamLabel={warWeek.teamLabel}
        entrantsLock={entrantsLock}
      />
      {view.bracket.matches.length > 0 && (
        <section className="flex min-w-0 flex-col gap-3" aria-label="Bracket">
          <h3 className="text-lg font-semibold">Bracket</h3>
          <BracketAdmin
            competitionId={id}
            placementPoints={competition.placementPoints}
            scoring={competition.scoring}
            scoreUnit={competition.scoreUnit}
            scoreDirection={competition.scoreDirection}
            entrants={view.entrants}
            bracket={view.bracket}
            winner={view.winner}
            podium={podiumOf(view)}
            closed={view.closed}
            primaryColor={warWeek.primaryColor}
            reporters={reporters}
          />
        </section>
      )}
    </div>
  );
}
