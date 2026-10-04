"use client";

import { Trophy } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { deleteResult } from "@/actions/logged-results";
import { Avatar } from "@/components/avatar";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { ResultForm, type ResultFormValue } from "@/components/result-form";
import {
  ProvisionalBadge,
  ResultsTable,
  type ResultsTableRow,
} from "@/components/results-table";
import { TOP_PLACES, TopFinishers } from "@/components/top-finishers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YouTag } from "@/components/you";
import type { BestScoreSettings } from "@/lib/best-score/config";
import {
  type AttemptFact,
  attemptsLabel,
  attemptsOf,
  sumsMembers,
} from "@/lib/best-score/standings";
import { placementLabel } from "@/lib/competitions";
import type { LoggedFormat } from "@/lib/enums";
import { formatScore, isMine } from "@/lib/logged-results";
import { formatPointsLabel } from "@/lib/points";
import { winnerKeys } from "@/lib/results-table";
import { type ScoringConfig, isSetByHand } from "@/lib/scoring";
import type { SeriesConfig } from "@/lib/series/config";
import { matchSummary, seriesNote, seriesOf } from "@/lib/series/standings";
import type {
  LogOffer,
  LoggedConfig,
  LoggedResultView,
  LoggedResultsName,
  LoggedResultsRow,
} from "@/queries/logged-results";

type Scoring = "team" | "individual";
type Linked = { participantId: string; teamId: string | null } | null;
type Filter = "all" | "mine";

/**
 * What a Head-to-head or Best score Competition's page shows, computed on
 * the server for one viewer: names, ids and booleans only, never an email
 * (R3 decision 17).
 */
export type LoggedResultsProps = {
  competitionId: string;
  format: LoggedFormat;
  config: LoggedConfig;
  scoring: Scoring;
  closed: boolean;
  /**
   * Ranked best first; unranked (no Match or Attempt yet) last; each with
   * its points.
   */
  leaderboard: LoggedResultsRow[];
  /** Newest first, each with whether the viewer may edit or delete it. */
  results: LoggedResultView[];
  /** The viewer's linked Participant and Team, for "Mine" and Your row. */
  linked: Linked;
  /** The viewer is an Organizer or a Host of this Competition. */
  runs: boolean;
  viewerCanLog: boolean;
  /** The Score direction and unit. */
  scoringConfig: ScoringConfig;
  /** The viewer's Log button (its label, disabled reason, Attempts left), or null. */
  logOffer: LogOffer | null;
  /** Best score's "Max attempts per person"; null for none. */
  maxAttempts: number | null;
  /** Best score: each Participant's Attempts so far, by id. */
  attemptCounts: Record<string, number>;
  /** A Head-to-head series won by a majority of its Best of. */
  decided: boolean;
  seriesWinner: string | null;
  /** A Head-to-head's two Entrants in order, or Best score's Participants. */
  playerOptions: LoggedResultsName[];
  primaryColor: string;
  /** What this War Week calls a Team, for a team Competition's header. */
  teamLabel: string;
  /** The server's clock, so "5 minutes ago" reads the same once hydrated. */
  now: Date;
  /**
   * Open the result form on load (`?log=1`, the home card's Log a Match or
   * Log an Attempt).
   */
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
export function ResultActions({
  competitionId,
  result,
  word,
  summary,
  onEdit,
}: {
  competitionId: string;
  result: LoggedResultView;
  /** "Match" (Head-to-head) or "Attempt" (Best score). */
  word: "Match" | "Attempt";
  summary: string;
  onEdit: (result: ResultFormValue) => void;
}) {
  if (!result.canEdit && !result.canDelete) return null;
  return (
    <span className="flex gap-2">
      {result.canEdit ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
          aria-label={`Edit ${word}: ${summary}`}
          onClick={() => onEdit({ id: result.id, players: result.players })}
        >
          Edit
        </Button>
      ) : null}
      {result.canDelete ? (
        <ConfirmActionButton
          title={`Delete this ${word}?`}
          description={`${summary}. The results update at once.`}
          confirmLabel="Delete"
          ariaLabel={`Delete ${word}: ${summary}`}
          action={() => deleteResult(competitionId, result.id)}
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
export function MatchLog({
  competitionId,
  results,
  filter,
  linked,
  now,
  onEdit,
}: {
  competitionId: string;
  results: LoggedResultView[];
  filter: Filter;
  linked: Linked;
  now: Date;
  onEdit: (result: ResultFormValue) => void;
}) {
  const shown =
    filter === "mine" && linked
      ? results.filter((g) => isMine(g.players, linked))
      : results;
  if (shown.length === 0) {
    return (
      <p className="text-foreground/70 text-sm">
        {filter === "mine" && results.length > 0
          ? "You haven't played a Match yet."
          : "No Matches yet."}
      </p>
    );
  }
  return (
    <Card size="sm" className="py-1">
      <ol className="flex flex-col divide-y px-(--card-spacing)">
        {shown.map((g) => {
          const summary = matchSummary(g.players);
          return (
            <li
              key={g.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium break-words">{summary}</span>
                <When at={g.recordedAt} now={now} />
              </span>
              <ResultActions
                competitionId={competitionId}
                result={g}
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

function entrantHeaderOf(scoring: Scoring, teamLabel: string): string {
  return scoring === "team" ? teamLabel : "Participant";
}

/**
 * A Best score Competition's results (spec R20, decision 4; R21, decision
 * 13): Top finishers, then one row per person or Team from their best
 * Attempt (under Sum of members, the sum of each member's best), with the
 * Score column in the configured unit and War Week points, Provisional
 * until Closed. A row with other Attempts expands to list them, each with
 * its Score and when; under Sum of members it lists every Attempt. Where
 * the viewer may change an Attempt, Edit and Delete sit in the expanded
 * row (the counted Attempt too, marked Best).
 */
export function BestScoreResults({
  competitionId,
  config,
  scoring,
  closed,
  rows,
  results,
  linked,
  primaryColor,
  teamLabel,
  now,
  onEdit,
}: {
  competitionId: string;
  config: BestScoreSettings;
  scoring: Scoring;
  closed: boolean;
  rows: LoggedResultsRow[];
  results: LoggedResultView[];
  linked: Linked;
  primaryColor: string;
  teamLabel: string;
  now: Date;
  onEdit: (result: ResultFormValue) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-foreground/70 text-sm">No Attempts yet.</p>;
  }
  const sum = sumsMembers(scoring, config);
  // Each Attempt as the standings read it: its row is `creditedTo`.
  const facts: AttemptFact[] = results.map((a) => ({
    id: a.id,
    recordedAt: new Date(a.recordedAt),
    participantId: a.players[0]?.id ?? "",
    teamId: a.creditedTo,
    score: a.players[0]?.score ?? 0,
  }));
  const byRow = attemptsOf(config, scoring, facts);
  const resultById = new Map(results.map((g) => [g.id, g]));

  const expansionOf = (row: LoggedResultsRow): ResultsTableRow["expansion"] => {
    const mine = byRow.get(row.id);
    if (!mine) return undefined;
    const others = mine.attempts.filter((id) => id !== mine.best);
    const best = mine.best === null ? undefined : resultById.get(mine.best);
    const listed =
      mine.best === null
        ? mine.attempts
        : best && (best.canEdit || best.canDelete)
          ? [mine.best, ...others]
          : others;
    if (listed.length === 0) return undefined;
    const visibleLabel =
      mine.best === null
        ? attemptsLabel(mine.attempts.length, "all")
        : others.length > 0
          ? attemptsLabel(others.length, "more")
          : attemptsLabel(1, "all");
    return {
      label: `${row.name}'s attempts`,
      visibleLabel,
      content: (
        <ul
          aria-label={`${row.name}'s attempts`}
          className="flex flex-col divide-y"
        >
          {listed.flatMap((id) => {
            const attempt = resultById.get(id);
            if (!attempt) return [];
            const player = attempt.players[0];
            const score = formatScore(player?.score ?? null, config.unit);
            const isBest = id === mine.best;
            return [
              <li
                key={id}
                data-slot="attempt"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
              >
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                  {scoring === "team" && player ? (
                    <span className="break-words">{player.name}</span>
                  ) : null}
                  <span className="font-medium tabular-nums">{score}</span>
                  {isBest ? <Badge variant="secondary">Best</Badge> : null}
                  <When at={attempt.recordedAt} now={now} />
                </span>
                <ResultActions
                  competitionId={competitionId}
                  result={attempt}
                  word="Attempt"
                  summary={`${player?.name ?? row.name} · ${score}`}
                  onEdit={onEdit}
                />
              </li>,
            ];
          })}
        </ul>
      ),
    };
  };

  const scoreOf = (row: LoggedResultsRow) => (sum ? row.total : row.best);
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
      <TopFinishers finishers={finishers} winners={winnerKeys(tableRows)} />
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
function recordText(row: LoggedResultsRow): string {
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
  rows: LoggedResultsRow[];
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
  scoringConfig,
  scoring,
  closed,
  entrants,
  results,
  linked,
  primaryColor,
  now,
  onEdit,
}: {
  competitionId: string;
  config: SeriesConfig;
  /** With a direction, a Match whose Winner differs from its Scores says "Set by hand". */
  scoringConfig: ScoringConfig;
  scoring: Scoring;
  closed: boolean;
  /** The two Entrants, in Seed Position order, with their places and points. */
  entrants: [LoggedResultsRow, LoggedResultsRow];
  results: LoggedResultView[];
  linked: Linked;
  primaryColor: string;
  now: Date;
  onEdit: (result: ResultFormValue) => void;
}) {
  const [a, b] = entrants;
  // Oldest first among equal times too: the view's list is newest first.
  const series = seriesOf(
    config,
    [...results].reverse().map((r) => ({
      ...r,
      recordedAt: new Date(r.recordedAt),
    })),
    [a.id, b.id],
    closed,
  );
  const nameOf = (id: string) => (id === a.id ? a.name : b.name);
  const resultById = new Map(results.map((g) => [g.id, g]));
  const winner = series.winner === null ? null : nameOf(series.winner);
  const note = seriesNote(config, series, closed);
  const side = (row: LoggedResultsRow, wins: number) => (
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
            ) : (
              <span data-slot="series-note">{note}</span>
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
                const logged = resultById.get(match.id)!;
                const scoreOf = (id: string) =>
                  logged.players.find((p) => p.id === id)?.score ?? null;
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
                            ? `${formatScore(scores[0], "")}–${formatScore(scores[1], "")}${scoringConfig.unit ? ` ${scoringConfig.unit}` : ""}`
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
                        {isSetByHand(
                          logged.players.map((p) => ({
                            id: p.id,
                            score: p.score,
                            place: p.place,
                          })),
                          scoringConfig.direction,
                        ) ? (
                          <span
                            data-slot="set-by-hand"
                            className="text-foreground/70 text-xs"
                          >
                            Set by hand
                          </span>
                        ) : null}
                        <When at={logged.recordedAt} now={now} />
                      </span>
                    </span>
                    <ResultActions
                      competitionId={competitionId}
                      result={logged}
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
 * The Log button: enabled, or disabled with its reason as visible text
 * beside it (a decided or drawn series, no Attempts left), never a hover
 * tooltip; a Participant's Attempts left under "Max attempts per person".
 */
export function LogButton({
  offer,
  onLog,
  className = "min-h-11 w-full md:w-auto",
  size = "lg",
}: {
  offer: LogOffer;
  onLog: () => void;
  className?: string;
  size?: "default" | "lg";
}) {
  const reasonId = useId();
  const left =
    offer.attemptsLeft === null || offer.disabledReason
      ? null
      : offer.attemptsLeft === 1
        ? "1 attempt left"
        : `${offer.attemptsLeft} attempts left`;
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
      <Button
        type="button"
        size={size}
        className={className}
        disabled={offer.disabledReason !== null}
        aria-describedby={offer.disabledReason ? reasonId : undefined}
        onClick={onLog}
      >
        {offer.label}
      </Button>
      {offer.disabledReason ? (
        <p
          id={reasonId}
          data-slot="log-disabled-reason"
          className="text-foreground/70 text-sm"
        >
          {offer.disabledReason}
        </p>
      ) : left ? (
        <p data-slot="attempts-left" className="text-foreground/70 text-sm">
          {left}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A Head-to-head's two Entrants as a series (spec R20, decision 7), in
 * Seed Position order. Null until both are set, when the results table
 * shows instead.
 */
function seriesEntrants(
  props: Pick<LoggedResultsProps, "format" | "leaderboard" | "playerOptions">,
): [LoggedResultsRow, LoggedResultsRow] | null {
  const { format, leaderboard, playerOptions } = props;
  if (format !== "head-to-head") return null;
  if (leaderboard.length !== 2) return null;
  const order = playerOptions.map((e) => e.id);
  const [a, b] = [...leaderboard].sort(
    (x, y) => order.indexOf(x.id) - order.indexOf(y.id),
  );
  return [a, b];
}

/**
 * A Head-to-head or Best score Competition on its page: the Closed or Best
 * of banner, Log a Match or Log an Attempt (when the viewer may), then the
 * Format's results: Best score's per-person table; a Head-to-head's
 * series; until its two Entrants are set, the Head-to-head table and its
 * Matches, with an All / Mine filter for a linked Participant.
 */
export function LoggedResults(props: LoggedResultsProps) {
  const {
    competitionId,
    format,
    config,
    scoring,
    closed,
    leaderboard,
    results: logged,
    linked,
    runs,
    viewerCanLog,
    scoringConfig,
    logOffer,
    maxAttempts,
    attemptCounts,
    decided,
    seriesWinner,
    playerOptions,
    primaryColor,
    teamLabel,
    now,
    openLog,
  } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(openLog && viewerCanLog);
  const [editing, setEditing] = useState<ResultFormValue | null>(null);
  const series = seriesEntrants(props);

  function openForm(result: ResultFormValue | null) {
    setEditing(result);
    setFormOpen(true);
  }

  let results: ReactNode;
  if (format === "best-score") {
    results = (
      <BestScoreResults
        competitionId={competitionId}
        config={config as BestScoreSettings}
        scoring={scoring}
        closed={closed}
        rows={leaderboard}
        results={logged}
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
        config={config as SeriesConfig}
        scoringConfig={scoringConfig}
        scoring={scoring}
        closed={closed}
        entrants={series}
        results={logged}
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
          <MatchLog
            competitionId={competitionId}
            results={logged}
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
      ) : decided && seriesWinner ? (
        <p
          role="status"
          className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm"
        >
          Best of decided: {seriesWinner}.
        </p>
      ) : null}

      {logOffer ? (
        <LogButton offer={logOffer} onLog={() => openForm(null)} />
      ) : null}

      {results}

      {viewerCanLog || logged.some((g) => g.canEdit) ? (
        <ResultForm
          open={formOpen}
          onOpenChange={setFormOpen}
          competitionId={competitionId}
          format={format}
          config={config}
          scoringConfig={scoringConfig}
          scoring={scoring}
          playerOptions={playerOptions}
          linked={linked}
          runs={runs}
          maxAttempts={maxAttempts}
          attemptCounts={attemptCounts}
          result={editing}
        />
      ) : null}
    </section>
  );
}
