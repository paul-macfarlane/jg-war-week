"use client";

import { useState } from "react";

import { GameForm, type GameFormGame } from "@/components/game-form";
import { BestScoreResults, GameLog } from "@/components/games-view";
import { Button } from "@/components/ui/button";
import type { GameFormat } from "@/lib/enums";
import type { BestScoreConfig, GamesConfig } from "@/lib/games/config";
import type {
  GamesViewGame,
  GamesViewName,
  GamesViewRow,
} from "@/queries/games";

export type AdminGamesProps = {
  competitionId: string;
  gameFormat: GameFormat;
  config: GamesConfig;
  scoring: "team" | "individual";
  closed: boolean;
  /** The server's answer: false once Closed (or logging is refused). */
  viewerCanLog: boolean;
  /** Ranked best first, each with its points (Best score's table). */
  leaderboard: GamesViewRow[];
  /** Newest first, each with whether the viewer may edit or delete it. */
  games: GamesViewGame[];
  /** Any Entrant may be picked as a player. */
  entrantOptions: GamesViewName[];
  primaryColor: string;
  teamLabel: string;
  now: Date;
};

/**
 * The Competition's results on its admin page (ticket 104; spec R20,
 * decision 4), with Log a Game. Best score shows the same per-person
 * table Participants see, with Edit and Delete of each Attempt in its
 * expanded row; Head-to-head keeps its list of Matches with Edit and
 * Delete. The viewer runs the Competition, so no player is preselected
 * and any Entrant can be picked; the server's Game authorization decides
 * what is allowed.
 */
export function AdminGames({
  competitionId,
  gameFormat,
  config,
  scoring,
  closed,
  viewerCanLog,
  leaderboard,
  games,
  entrantOptions,
  primaryColor,
  teamLabel,
  now,
}: AdminGamesProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GameFormGame | null>(null);
  const bestScore = gameFormat === "best-score";
  const title = bestScore ? "Attempts" : "Matches";

  function openForm(game: GameFormGame | null) {
    setEditing(game);
    setFormOpen(true);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {viewerCanLog ? (
          <Button
            type="button"
            className="min-h-11 sm:min-h-0"
            onClick={() => openForm(null)}
          >
            Log a Game
          </Button>
        ) : null}
      </div>
      {bestScore ? (
        <BestScoreResults
          competitionId={competitionId}
          config={config as BestScoreConfig}
          scoring={scoring}
          closed={closed}
          rows={leaderboard}
          games={games}
          linked={null}
          primaryColor={primaryColor}
          teamLabel={teamLabel}
          now={now}
          onEdit={openForm}
        />
      ) : (
        <GameLog
          competitionId={competitionId}
          gameFormat={gameFormat}
          unit=""
          games={games}
          filter="all"
          linked={null}
          now={now}
          onEdit={openForm}
        />
      )}
      {viewerCanLog || games.some((g) => g.canEdit) ? (
        <GameForm
          open={formOpen}
          onOpenChange={setFormOpen}
          competitionId={competitionId}
          gameFormat={gameFormat}
          config={config}
          scoring={scoring}
          entrantOptions={entrantOptions}
          linked={null}
          game={editing}
        />
      ) : null}
    </section>
  );
}
