"use client";

import { Trophy } from "lucide-react";
import { type ReactNode, useState } from "react";

import { deleteGame } from "@/actions/games";
import { Avatar } from "@/components/avatar";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { ResultForm, type ResultFormGame } from "@/components/result-form";
import {
  ProvisionalBadge,
  ResultsTable,
  type ResultsTableRow,
} from "@/components/results-table";
import { TopFinishers } from "@/components/top-finishers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YouTag } from "@/components/you";
import { placementLabel } from "@/lib/competitions";
import type { GameFormat } from "@/lib/enums";
import {
  type BestScoreConfig,
  type GamesConfig,
  type HeadToHeadConfig,
  resultNoun,
} from "@/lib/games/config";
import { attemptsOf } from "@/lib/games/leaderboard";
import {
  attemptsLabel,
  formatScore,
  gameSummary,
  isMine,
  seriesOf,
} from "@/lib/games/view";
import { formatPointsLabel } from "@/lib/points";
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
  /** Anyone eligible may play; false for a fixed Entrant list. */
  entrantsOpen: boolean;
  loggingOpen: boolean;
  /** Ranked best first; unranked (no Game yet) last; each with its points. */
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
  /** The Entrants (a fixed list in its order), or everyone eligible. */
  entrantOptions: GamesViewName[];
  primaryColor: string;
  /** What this War Week calls a Team, for a team Competition's header. */
  teamLabel: string;
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

function When({ at, now }: { at: Date; now: Date }) {
  return (
    <time
      dateTime={new Date(at).toISOString()}
      className="text-foreground/60 text-xs"
    >
      {timeAgo(new Date(at), now)}
    </time>
  );
}

/** A row's lead: a person's Avatar, or a Team's color dot. */
function Lead({
  scoring,
  row,
  primaryColor,
}: {
  scoring: Scoring;
  row: { name: string; color: string | null; image?: string | null };
  primaryColor: string;
}) {
  return scoring === "individual" ? (
    <Avatar
      name={row.name}
      teamColor={row.color}
      primaryColor={primaryColor}
      image={row.image}
      className="size-6"
    />
  ) : (
    <span
      aria-hidden
      className="mt-1 size-3 shrink-0 rounded-full"
      style={{ backgroundColor: row.color ?? primaryColor }}
    />
  );
}

/** "You" on your own row, "Your Team" on your Team's. */
function YouMark({
  scoring,
  id,
  linked,
}: {
  scoring: Scoring;
  id: string;
  linked: Linked;
}) {
  if (scoring === "individual") return <YouTag participantId={id} />;
  return linked?.teamId === id ? (
    <span
      data-you
      className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-semibold"
    >
      Your Team
    </span>
  ) : null;
}

/**
 * Edit and Delete for one Match or Attempt, shown only when the server
 * said the viewer may change it; Delete asks first (`ConfirmDialog`) and
 * toasts the result.
 */
export function GameActions({
  competitionId,
  game,
  word,
  summary,
  onEdit,
}: {
  competitionId: string;
  game: GamesViewGame;
  /** "Match" (Head-to-head) or "Attempt" (Best score). */
  word: "Match" | "Attempt";
  summary: string;
  onEdit: (game: ResultFormGame) => void;
}) {
  if (!game.canEdit && !game.canDelete) return null;
  return (
    <span className="flex gap-2">
      {game.canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
          aria-label={`Edit ${word}: ${summary}`}
          onClick={() => onEdit({ id: game.id, players: game.players })}
        >
          Edit
        </Button>
      ) : null}
      {game.canDelete ? (
        <ConfirmActionButton
          title={`Delete this ${word}?`}
          description={`${summary}. The results update at once.`}
          confirmLabel="Delete"
          ariaLabel={`Delete ${word}: ${summary}`}
          action={() => deleteGame(competitionId, game.id)}
          successMessage={`${word} deleted`}
          className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
        >
          Delete
        </ConfirmActionButton>
      ) : null}
    </span>
  );
}

/**
 * A Head-to-head Competition's Matches, newest first; under "Mine", only
 * the viewer's. Edit and Delete show on the Matches the server said the
 * viewer may change.
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
  onEdit: (game: ResultFormGame) => void;
}) {
  const shown =
    filter === "mine" && linked
      ? games.filter((g) => isMine(g.players, linked))
      : games;
  if (shown.length === 0) {
    return (
      <p className="text-foreground/70 text-sm">
        {filter === "mine" && games.length > 0
          ? "You haven't played a Match yet."
          : "No Matches yet."}
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
                <When at={g.loggedAt} now={now} />
              </span>
              <GameActions
                competitionId={competitionId}
                game={g}
                word="Match"
                summary={summary}
                onEdit={onEdit}
              />
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** How many places the Top finishers summary shows. */
const TOP_PLACES = 3;

function entrantHeaderOf(scoring: Scoring, teamLabel: string): string {
  return scoring === "team" ? teamLabel : "Participant";
}

/**
 * A Best score Competition's results (spec R20, decision 4): Top
 * finishers, then one row per person or Team from their best Attempt (in
 * `total` mode, their total), with the Score column in the configured
 * unit and War Week points, Provisional until Closed. A row with other
 * Attempts expands to list them, each with its Score and when; in `total`
 * mode it lists every Attempt the total adds up. Where the viewer may
 * change an Attempt, Edit and Delete sit in the expanded row (the counted
 * Attempt too, marked Best).
 */
export function BestScoreResults({
  competitionId,
  config,
  scoring,
  closed,
  rows,
  games,
  linked,
  primaryColor,
  teamLabel,
  now,
  onEdit,
}: {
  competitionId: string;
  config: BestScoreConfig;
  scoring: Scoring;
  closed: boolean;
  rows: GamesViewRow[];
  games: GamesViewGame[];
  linked: Linked;
  primaryColor: string;
  teamLabel: string;
  now: Date;
  onEdit: (game: ResultFormGame) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-foreground/70 text-sm">No Attempts yet.</p>;
  }
  const byPlayer = attemptsOf(config, games);
  const gameById = new Map(games.map((g) => [g.id, g]));
  const scoreIn = (game: GamesViewGame, id: string) =>
    game.players.find((p) => p.id === id)?.score ?? null;

  const expansionOf = (row: GamesViewRow): ResultsTableRow["expansion"] => {
    const mine = byPlayer.get(row.id);
    if (!mine) return undefined;
    const others = mine.attempts.filter((id) => id !== mine.best);
    const best = gameById.get(mine.best);
    const listed =
      config.count === "total"
        ? mine.attempts
        : best && (best.canEdit || best.canDelete)
          ? [mine.best, ...others]
          : others;
    if (listed.length === 0) return undefined;
    const visibleLabel =
      config.count === "total"
        ? attemptsLabel(mine.attempts.length, "total")
        : others.length > 0
          ? attemptsLabel(others.length, "best")
          : attemptsLabel(1, "total");
    return {
      label: `${row.name}'s attempts`,
      visibleLabel,
      content: (
        <ul
          aria-label={`${row.name}'s attempts`}
          className="flex flex-col divide-y"
        >
          {listed.flatMap((id) => {
            const game = gameById.get(id);
            if (!game) return [];
            const score = formatScore(scoreIn(game, row.id), config.unit);
            const isBest = config.count === "best" && id === mine.best;
            return [
              <li
                key={id}
                data-slot="attempt"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
              >
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium tabular-nums">{score}</span>
                  {isBest ? <Badge variant="secondary">Best</Badge> : null}
                  <When at={game.loggedAt} now={now} />
                </span>
                <GameActions
                  competitionId={competitionId}
                  game={game}
                  word="Attempt"
                  summary={`${row.name} · ${score}`}
                  onEdit={onEdit}
                />
              </li>,
            ];
          })}
        </ul>
      ),
    };
  };

  const scoreOf = (row: GamesViewRow) =>
    config.count === "best" ? row.best : row.total;
  const tableRows: ResultsTableRow[] = rows.map((row) => ({
    key: row.id,
    rank: row.rank,
    name: row.name,
    lead: <Lead scoring={scoring} row={row} primaryColor={primaryColor} />,
    after: <YouMark scoring={scoring} id={row.id} linked={linked} />,
    score: scoreOf(row),
    points: row.points,
    expansion: expansionOf(row),
  }));
  const finishers = rows.flatMap((row) =>
    row.rank !== null && row.rank <= TOP_PLACES
      ? [
          {
            key: row.id,
            place: row.rank,
            name: row.name,
            points: row.points,
            lead: (
              <Lead scoring={scoring} row={row} primaryColor={primaryColor} />
            ),
          },
        ]
      : [],
  );
  return (
    <div className="flex flex-col gap-3">
      <TopFinishers finishers={finishers} />
      <ResultsTable
        rows={tableRows}
        label="Best score results"
        entrantHeader={entrantHeaderOf(scoring, teamLabel)}
        scoreUnit={config.unit || null}
        provisional={!closed}
      />
    </div>
  );
}

/** A Head-to-head row's record, in words: "2 won · 1 lost · 0 drawn". */
function recordText(row: GamesViewRow): string {
  return `${row.wins} won · ${row.losses} lost · ${row.draws} drawn`;
}

/**
 * A Head-to-head Competition with other than two Entrants: the results
 * table, ranked by Matches won, each row's record under its name.
 */
function HeadToHeadTable({
  scoring,
  closed,
  rows,
  linked,
  primaryColor,
  teamLabel,
}: {
  scoring: Scoring;
  closed: boolean;
  rows: GamesViewRow[];
  linked: Linked;
  primaryColor: string;
  teamLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-foreground/70 text-sm">No players yet.</p>;
  }
  return (
    <ResultsTable
      rows={rows.map((row) => ({
        key: row.id,
        rank: row.rank,
        name: row.name,
        lead: <Lead scoring={scoring} row={row} primaryColor={primaryColor} />,
        after: <YouMark scoring={scoring} id={row.id} linked={linked} />,
        detail: row.played > 0 ? recordText(row) : null,
        points: row.points,
      }))}
      label="Head-to-head results"
      entrantHeader={entrantHeaderOf(scoring, teamLabel)}
      provisional={!closed}
    />
  );
}

/**
 * A two-Entrant Head-to-head as a series (spec R20, decision 7): no
 * leaderboard. The series score with its Winner once decided, the Matches
 * in order with both Scores and each one's Winner (or Draw), and the
 * Placement Points each Entrant gets, Provisional until Closed.
 */
export function SeriesView({
  competitionId,
  config,
  scoring,
  closed,
  entrants,
  games,
  linked,
  primaryColor,
  now,
  onEdit,
}: {
  competitionId: string;
  config: HeadToHeadConfig;
  scoring: Scoring;
  closed: boolean;
  /** The two Entrants, in the fixed list's order, with their places and points. */
  entrants: [GamesViewRow, GamesViewRow];
  games: GamesViewGame[];
  linked: Linked;
  primaryColor: string;
  now: Date;
  onEdit: (game: ResultFormGame) => void;
}) {
  const [a, b] = entrants;
  // Oldest first among equal times too: the view's list is newest first.
  const series = seriesOf(config, [...games].reverse(), [a.id, b.id], closed);
  const nameOf = (id: string) => (id === a.id ? a.name : b.name);
  const gameById = new Map(games.map((g) => [g.id, g]));
  const winner = series.winner === null ? null : nameOf(series.winner);
  const side = (row: GamesViewRow, wins: number) => (
    <span className="flex min-w-0 flex-col items-center gap-1 text-center">
      <Lead scoring={scoring} row={row} primaryColor={primaryColor} />
      <span className="flex flex-wrap items-center justify-center gap-1">
        <span className="font-medium break-words">{row.name}</span>
        <YouMark scoring={scoring} id={row.id} linked={linked} />
      </span>
      <span className="sr-only">{wins} won</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Series" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Series</h2>
        <Card size="sm" className="px-(--card-spacing)">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {side(a, series.wins[0])}
            <span
              data-slot="series-score"
              className="text-2xl font-bold tabular-nums"
            >
              {series.score}
            </span>
            {side(b, series.wins[1])}
          </div>
          <p className="text-foreground/70 flex flex-wrap items-center justify-center gap-2 text-center text-sm">
            {winner ? (
              <span
                data-slot="series-winner"
                className="flex items-center gap-1 font-semibold"
              >
                <Trophy aria-hidden className="text-primary size-4" />
                <Badge>Winner</Badge>
                {winner}
              </span>
            ) : config.bestOf !== null ? (
              <span>
                Best of {config.bestOf}: first to{" "}
                {Math.floor(config.bestOf / 2) + 1} wins.
              </span>
            ) : (
              <span>The series Winner is decided at Close.</span>
            )}
            {series.draws > 0 ? (
              <span>
                {series.draws} {series.draws === 1 ? "draw" : "draws"}
              </span>
            ) : null}
          </p>
        </Card>
      </section>

      <section aria-label="Matches" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Matches</h2>
        {series.matches.length === 0 ? (
          <p className="text-foreground/70 text-sm">No Matches yet.</p>
        ) : (
          <Card size="sm" className="py-1">
            <ol className="flex flex-col divide-y px-(--card-spacing)">
              {series.matches.map((match, i) => {
                const game = gameById.get(match.id)!;
                const scoreOf = (id: string) =>
                  game.players.find((p) => p.id === id)?.score ?? null;
                const scores = [scoreOf(a.id), scoreOf(b.id)];
                const scored = scores.some((s) => s !== null);
                const result =
                  match.winner === "draw"
                    ? "Draw"
                    : match.winner === null
                      ? "No Winner"
                      : `Winner: ${nameOf(match.winner)}`;
                const summary = `Match ${i + 1}: ${a.name}${
                  scored ? ` ${formatScore(scores[0], "")}` : ""
                } vs ${b.name}${scored ? ` ${formatScore(scores[1], "")}` : ""}`;
                return (
                  <li
                    key={match.id}
                    data-slot="series-match"
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-foreground/60 text-xs font-medium">
                        Match {i + 1}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="break-words">{a.name}</span>
                        <span
                          data-slot="series-match-score"
                          className="font-semibold tabular-nums"
                        >
                          {scored
                            ? `${formatScore(scores[0], "")}–${formatScore(scores[1], "")}`
                            : "vs"}
                        </span>
                        <span className="break-words">{b.name}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            match.winner === "draw" ? "outline" : "secondary"
                          }
                          data-slot="series-match-result"
                        >
                          {result}
                        </Badge>
                        <When at={game.loggedAt} now={now} />
                      </span>
                    </span>
                    <GameActions
                      competitionId={competitionId}
                      game={game}
                      word="Match"
                      summary={summary}
                      onEdit={onEdit}
                    />
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
      </section>

      <section aria-label="Placement Points" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Placement Points</h2>
          {closed ? (
            <Badge variant="secondary">Closed</Badge>
          ) : (
            <ProvisionalBadge />
          )}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {entrants.map((row) => (
            <li
              key={row.id}
              data-slot="series-points"
              className="flex min-w-0 items-center gap-2 rounded-lg border p-3 text-sm"
            >
              <span className="w-10 shrink-0 font-semibold tabular-nums">
                {row.rank === null ? "–" : placementLabel(row.rank)}
              </span>
              <span className="min-w-0 flex-1 font-medium break-words">
                {row.name}
              </span>
              <span
                data-slot="series-points-value"
                className="font-semibold tabular-nums"
              >
                {row.points === null
                  ? "No points"
                  : formatPointsLabel(row.points)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * The two Entrants of a Head-to-head run as a series: a fixed Entrant list
 * of exactly two (spec R20, decision 7), in the list's order. Null for any
 * other Competition, which keeps the results table.
 */
function seriesEntrants(
  props: Pick<
    GamesViewProps,
    "gameFormat" | "entrantsOpen" | "leaderboard" | "entrantOptions"
  >,
): [GamesViewRow, GamesViewRow] | null {
  const { gameFormat, entrantsOpen, leaderboard, entrantOptions } = props;
  if (gameFormat !== "head-to-head" || entrantsOpen) return null;
  if (leaderboard.length !== 2) return null;
  const order = entrantOptions.map((e) => e.id);
  const [a, b] = [...leaderboard].sort(
    (x, y) => order.indexOf(x.id) - order.indexOf(y.id),
  );
  return [a, b];
}

/**
 * A Head-to-head or Best score Competition on its page: the closed or Best
 * of banner, Log a Game (when the viewer may), then the Format's results:
 * Best score's per-person table; a two-Entrant Head-to-head's series;
 * otherwise the Head-to-head table and its Matches, with an All / Mine
 * filter for a linked Participant.
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
    teamLabel,
    now,
    openLog,
  } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(openLog && viewerCanLog);
  const [editing, setEditing] = useState<ResultFormGame | null>(null);
  const series = seriesEntrants(props);

  function openForm(game: ResultFormGame | null) {
    setEditing(game);
    setFormOpen(true);
  }

  let results: ReactNode;
  if (gameFormat === "best-score") {
    results = (
      <BestScoreResults
        competitionId={competitionId}
        config={config as BestScoreConfig}
        scoring={scoring}
        closed={closed}
        rows={leaderboard}
        games={games}
        linked={linked}
        primaryColor={primaryColor}
        teamLabel={teamLabel}
        now={now}
        onEdit={openForm}
      />
    );
  } else if (series) {
    results = (
      <SeriesView
        competitionId={competitionId}
        config={config as HeadToHeadConfig}
        scoring={scoring}
        closed={closed}
        entrants={series}
        games={games}
        linked={linked}
        primaryColor={primaryColor}
        now={now}
        onEdit={openForm}
      />
    );
  } else {
    results = (
      <>
        <HeadToHeadTable
          scoring={scoring}
          closed={closed}
          rows={leaderboard}
          linked={linked}
          primaryColor={primaryColor}
          teamLabel={teamLabel}
        />
        <section aria-label="Matches" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Matches</h2>
            {linked ? (
              <Tabs
                value={filter}
                onValueChange={(value) => setFilter(value as Filter)}
              >
                <TabsList aria-label="Show Matches" className="h-11 sm:h-8">
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
            unit=""
            games={games}
            filter={filter}
            linked={linked}
            now={now}
            onEdit={openForm}
          />
        </section>
      </>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Results">
      {closed ? (
        <p
          role="status"
          className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm"
        >
          Closed — its Placement Points are in the Standings.
        </p>
      ) : bestOfDecided && bestOfWinner ? (
        <p
          role="status"
          className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm"
        >
          Best of decided: {bestOfWinner}.
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
          {`Log ${resultNoun(gameFormat).a}`}
        </Button>
      ) : null}

      {results}

      {viewerCanLog || games.some((g) => g.canEdit) ? (
        <ResultForm
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
