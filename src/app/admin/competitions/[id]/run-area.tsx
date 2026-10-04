import { AdminGames } from "@/components/admin-games";
import { BracketAdmin } from "@/components/bracket-admin";
import { BracketBuilder } from "@/components/bracket-builder";
import { GamesBuilder } from "@/components/games-builder";
import { ParticipationBuilder } from "@/components/participation-builder";
import { PlacementSheet } from "@/components/placement-sheet";
import type { Competition, WarWeek } from "@/db/schema";
import { podiumOf } from "@/lib/bracket/podium";
import {
  type CompetitionLockFacts,
  settingLockReason,
} from "@/lib/competition-locks";
import { isGameFormat } from "@/lib/enums";
import { resultNoun } from "@/lib/games/config";
import {
  getBracket,
  getBracketEntrants,
  getMatchReporters,
  getSquads,
} from "@/queries/brackets";
import { getGamesView } from "@/queries/games";
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
  if (isGameFormat(format)) return `Entrants and ${resultNoun(format).many}`;
  return "Entrants and Bracket";
}

/**
 * The Format's run area on the Competition page (ticket 101), below the
 * Settings: Record placements (Placement); the Entrants and the Bracket
 * tree with Close (Bracket); the Entrant list and Close (Head-to-head,
 * Best score); who took part and Close (Participation). Each loads its own
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
  /** The viewer, for the Games view's "Mine". */
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
        roster={options.participants.map(({ id: pid, name, team }) => ({
          id: pid,
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
    );
  }

  if (isGameFormat(competition.format)) {
    const [view, options, entrants] = await Promise.all([
      getGamesView(id, email),
      getTargetOptions(warWeek),
      getBracketEntrants(id),
    ]);
    if (!view) return null;
    return (
      <div className="flex flex-col gap-10">
        <GamesBuilder
          competition={{
            id,
            scoring: view.competition.scoring,
            gameFormat: view.competition.gameFormat,
            entrantsOpen: view.competition.entrantsOpen,
            closed: view.competition.closed,
            placementPoints: view.competition.placementPoints,
            bestOfDecided: view.bestOfDecided,
            bestOfWinner: view.bestOfWinner,
          }}
          entrants={entrants.map(({ teamId, participantId }) => ({
            teamId,
            participantId,
          }))}
          teams={options.teams}
          participants={options.participants}
          entrantsLock={entrantsLock}
        />
        <AdminGames
          competitionId={id}
          gameFormat={view.competition.gameFormat}
          config={view.competition.config}
          scoring={view.competition.scoring}
          closed={view.competition.closed}
          viewerCanLog={view.viewerCanLog}
          leaderboard={view.leaderboard}
          games={view.games}
          entrantOptions={view.entrantOptions}
          primaryColor={warWeek.primaryColor}
          teamLabel={warWeek.teamLabel}
          now={new Date()}
        />
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
