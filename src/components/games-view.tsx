"use client";

import Link from "next/link";
import { useState } from "react";

import { deleteGame } from "@/actions/games";
import { Avatar } from "@/components/avatar";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { GameForm, type GameFormGame } from "@/components/game-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YouTag } from "@/components/you";
import { competitionPageHref } from "@/lib/competitions";
import type { GameFormat } from "@/lib/enums";
import type {
  BestScoreConfig,
  GamesConfig,
  GamesConfigFor,
} from "@/lib/games/config";
import { gameSummary, isMine, leaderboardColumns } from "@/lib/games/view";
import { YOU_ROW_CLASS } from "@/lib/you";
import type {
  GamesViewGame,
  GamesViewName,
  GamesViewRow,
} from "@/queries/games";

type Scoring = "team" | "individual";
type Linked = { participantId: string; teamId: string | null } | null;
type Filter = "all" | "mine";

/**
 * What a Head-to-head or Best score Competition's page shows, computed on the server for one
 * viewer: names, ids and booleans only, never an email (R3 decision 17).
 */
export type GamesViewProps = {
  competitionId: string;
  gameFormat: GameFormat;
  config: GamesConfig;
  scoring: Scoring;
  closed: boolean;
  loggingOpen: boolean;
  /** Ranked best first; unranked (no Game yet) last. */
  leaderboard: GamesViewRow[];
  /** Newest first, each with whether the viewer may edit or delete it. */
  games: GamesViewGame[];
  /** The viewer's linked Participant and Team, for "Mine" and Your row. */
  linked: Linked;
  /** The viewer is an Organizer or a Host of this Competition. */
  runs: boolean;
  viewerCanLog: boolean;
  bestOfDecided: boolean;
  bestOfWinner: string | null;
  entrantOptions: GamesViewName[];
  primaryColor: string;
  /** The server's clock, so "5 minutes ago" reads the same once hydrated. */
  now: Date;
  /** Open the Game form on load (`?log=1`, the home "Log a Game" card). */
  openLog: boolean;
};

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". */
function timeAgo(then: Date, now: Date): string {
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.trunc(seconds / size), unit);
    }
  }
  return "just now";
}

function statValue(row: GamesViewRow, key: string): string {
  if (row.rank === null) return "—";
  const value = row[key as keyof GamesViewRow];
  return value === null || value === undefined ? "—" : String(value);
}

/** The leaderboard: rank, player, and the Format's stats (Games rules). */
export function GamesLeaderboard({
  gameFormat,
  config,
  scoring,
  rows,
  linked,
  primaryColor,
}: {
  gameFormat: GameFormat;
  config: GamesConfig;
  scoring: Scoring;
  rows: GamesViewRow[];
  linked: Linked;
  primaryColor: string;
}) {
  const columns = leaderboardColumns(
    gameFormat,
    config as GamesConfigFor<typeof gameFormat>,
  );
  if (rows.length === 0) {
    return <p className="text-foreground/70 text-sm">No players yet.</p>;
  }
  return (
    <Card size="sm" className="overflow-x-auto py-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-foreground/60 text-left text-xs">
            <th scope="col" className="w-10 px-3 py-2 font-medium">
              Rank
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              {scoring === "team" ? "Team" : "Player"}
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="px-2 py-2 text-right font-medium"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className={YOU_ROW_CLASS}>
              <td className="text-foreground/60 px-3 py-2 font-medium tabular-nums">
                {row.rank ?? "—"}
              </td>
              <th scope="row" className="px-2 py-2 text-left font-normal">
                <span className="flex items-center gap-2">
                  {scoring === "individual" ? (
                    <Avatar
                      name={row.name}
                      teamColor={row.color}
                      primaryColor={primaryColor}
                      image={row.image}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color ?? primaryColor }}
                    />
                  )}
                  <span className="font-medium">{row.name}</span>
                  {scoring === "individual" ? (
                    <YouTag participantId={row.id} />
                  ) : linked?.teamId === row.id ? (
                    <span
                      data-you
                      className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-semibold"
                    >
                      Your Team
                    </span>
                  ) : null}
                </span>
              </th>
              {columns.map((c) => (
                <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                  {statValue(row, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/**
 * The Game log, newest first; under "Mine", only the viewer's Games. Edit
 * and Delete show on the Games the server said the viewer may change;
 * Delete asks first.
 */
export function GameLog({
  competitionId,
  gameFormat,
  unit,
  games,
  filter,
  linked,
  now,
  onEdit,
}: {
  competitionId: string;
  gameFormat: GameFormat;
  unit: string;
  games: GamesViewGame[];
  filter: Filter;
  linked: Linked;
  now: Date;
  onEdit: (game: GameFormGame) => void;
}) {
  const shown =
    filter === "mine" && linked
      ? games.filter((g) => isMine(g.players, linked))
      : games;
  if (shown.length === 0) {
    return (
      <p className="text-foreground/70 text-sm">
        {filter === "mine" && games.length > 0
          ? "You haven't played a Game yet."
          : "No Games yet."}
      </p>
    );
  }
  return (
    <Card size="sm" className="py-1">
      <ol className="flex flex-col divide-y px-(--card-spacing)">
        {shown.map((g) => {
          const summary = gameSummary(gameFormat, g.players, unit);
          return (
            <li
              key={g.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium break-words">{summary}</span>
                <time
                  dateTime={new Date(g.loggedAt).toISOString()}
                  className="text-foreground/60 text-xs"
                >
                  {timeAgo(new Date(g.loggedAt), now)}
                </time>
              </span>
              {g.canEdit || g.canDelete ? (
                <span className="flex gap-2">
                  {g.canEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
                      aria-label={`Edit Game: ${summary}`}
                      onClick={() => onEdit({ id: g.id, players: g.players })}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {g.canDelete ? (
                    <ConfirmActionButton
                      title="Delete this Game?"
                      description={`${summary}. The leaderboard updates at once.`}
                      confirmLabel="Delete"
                      ariaLabel={`Delete Game: ${summary}`}
                      action={() => deleteGame(competitionId, g.id)}
                      successMessage="Game deleted"
                    >
                      Delete
                    </ConfirmActionButton>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * A Head-to-head or Best score Competition on its page: the closed or Best of banner, Log a
 * Game (when the viewer may), the leaderboard, and the Game log with an
 * All / Mine filter for a linked Participant.
 */
export function GamesView(props: GamesViewProps) {
  const {
    competitionId,
    gameFormat,
    config,
    scoring,
    closed,
    loggingOpen,
    leaderboard,
    games,
    linked,
    runs,
    viewerCanLog,
    bestOfDecided,
    bestOfWinner,
    entrantOptions,
    primaryColor,
    now,
    openLog,
  } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(openLog && viewerCanLog);
  const [editing, setEditing] = useState<GameFormGame | null>(null);
  const unit =
    gameFormat === "best-score" ? (config as BestScoreConfig).unit : "";

  function openForm(game: GameFormGame | null) {
    setEditing(game);
    setFormOpen(true);
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Games">
      {closed ? (
        <p
          role="status"
          className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm"
        >
          Closed — the leaderboard&apos;s Placement Points are in the Standings.
        </p>
      ) : bestOfDecided && bestOfWinner ? (
        <p
          role="status"
          className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm"
        >
          {runs ? (
            <>
              Best of decided: {bestOfWinner} —{" "}
              <Link
                href={competitionPageHref(competitionId)}
                className="text-primary font-medium underline underline-offset-4"
              >
                Close it
              </Link>
            </>
          ) : (
            <>Best of decided: {bestOfWinner}.</>
          )}
        </p>
      ) : !loggingOpen && linked && !runs ? (
        <p className="text-foreground/70 text-sm">Logging is closed.</p>
      ) : null}

      {viewerCanLog ? (
        <Button
          type="button"
          size="lg"
          className="min-h-11 w-full md:w-auto md:self-start"
          onClick={() => openForm(null)}
        >
          Log a Game
        </Button>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Leaderboard</h2>
        <GamesLeaderboard
          gameFormat={gameFormat}
          config={config}
          scoring={scoring}
          rows={leaderboard}
          linked={linked}
          primaryColor={primaryColor}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Games</h2>
          {linked ? (
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as Filter)}
            >
              <TabsList aria-label="Show Games" className="h-11 sm:h-8">
                <TabsTrigger value="all" className="px-3">
                  All
                </TabsTrigger>
                <TabsTrigger value="mine" className="px-3">
                  Mine
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
        </div>
        <GameLog
          competitionId={competitionId}
          gameFormat={gameFormat}
          unit={unit}
          games={games}
          filter={filter}
          linked={linked}
          now={now}
          onEdit={openForm}
        />
      </div>

      {viewerCanLog || games.some((g) => g.canEdit) ? (
        <GameForm
          open={formOpen}
          onOpenChange={setFormOpen}
          competitionId={competitionId}
          gameFormat={gameFormat}
          config={config}
          scoring={scoring}
          entrantOptions={entrantOptions}
          linked={linked}
          game={editing}
        />
      ) : null}
    </section>
  );
}
