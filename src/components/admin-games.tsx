"use client";

import { useState } from "react";

import { BestScoreResults, MatchLog } from "@/components/games-view";
import { ResultForm, type ResultFormValue } from "@/components/result-form";
import { Button } from "@/components/ui/button";
import type { GameFormat } from "@/lib/enums";
import {
  type BestScoreConfig,
  type GamesConfig,
  resultNoun,
} from "@/lib/games/config";
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
 * decision 4), with Log a Match or Log an Attempt. Best score shows the
 * same per-person table Participants see, with Edit and Delete of each
 * Attempt in its expanded row; Head-to-head keeps its list of Matches with
 * Edit and Delete. The viewer runs the Competition, so no player is
 * preselected and any Entrant can be picked; the server's rule for
 * logging a Match or Attempt decides what is allowed.
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
  const [editing, setEditing] = useState<ResultFormValue | null>(null);
  const bestScore = gameFormat === "best-score";
  const noun = resultNoun(gameFormat);

  function openForm(result: ResultFormValue | null) {
    setEditing(result);
    setFormOpen(true);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={noun.many}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{noun.many}</h3>
        {viewerCanLog ? (
          <Button
            type="button"
            className="min-h-11 sm:min-h-0"
            onClick={() => openForm(null)}
          >
            {`Log ${noun.a}`}
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
        <MatchLog
          competitionId={competitionId}
          games={games}
          filter="all"
          linked={null}
          now={now}
          onEdit={openForm}
        />
      )}
      {viewerCanLog || games.some((g) => g.canEdit) ? (
        <ResultForm
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
