"use client";

import { useState } from "react";

import { GameForm, type GameFormGame } from "@/components/game-form";
import { GameLog } from "@/components/games-view";
import { Button } from "@/components/ui/button";
import type { GameFormat } from "@/lib/enums";
import type { BestScoreConfig, GamesConfig } from "@/lib/games/config";
import type { GamesViewGame, GamesViewName } from "@/queries/games";

export type AdminGamesProps = {
  competitionId: string;
  gameFormat: GameFormat;
  config: GamesConfig;
  scoring: "team" | "individual";
  /** The server's answer: false once Closed (or logging is refused). */
  viewerCanLog: boolean;
  /** Newest first, each with whether the viewer may edit or delete it. */
  games: GamesViewGame[];
  /** Any Entrant may be picked as a player. */
  entrantOptions: GamesViewName[];
  now: Date;
};

/**
 * The Competition's Games on its admin page (ticket 104): Log a Game, and
 * Edit and Delete on each Game, with the same form and log Participants
 * use. The viewer runs the Competition, so no player is preselected and
 * any Entrant can be picked; the server's Game authorization decides
 * what is allowed.
 */
export function AdminGames({
  competitionId,
  gameFormat,
  config,
  scoring,
  viewerCanLog,
  games,
  entrantOptions,
  now,
}: AdminGamesProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GameFormGame | null>(null);
  const unit =
    gameFormat === "best-score" ? (config as BestScoreConfig).unit : "";

  function openForm(game: GameFormGame | null) {
    setEditing(game);
    setFormOpen(true);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Games">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Games</h3>
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
      <GameLog
        competitionId={competitionId}
        gameFormat={gameFormat}
        unit={unit}
        games={games}
        filter="all"
        linked={null}
        now={now}
        onEdit={openForm}
      />
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
