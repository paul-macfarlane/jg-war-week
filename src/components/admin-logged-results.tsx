"use client";

import { useState } from "react";

import {
  BestScoreResults,
  LogButton,
  MatchLog,
} from "@/components/logged-results-view";
import { ResultForm, type ResultFormValue } from "@/components/result-form";
import type { BestScoreSettings } from "@/lib/best-score/config";
import type { LoggedFormat } from "@/lib/enums";
import { resultNoun } from "@/lib/logged-results";
import type { ScoringConfig } from "@/lib/scoring";
import type {
  LogOffer,
  LoggedConfig,
  LoggedResultView,
  LoggedResultsName,
  LoggedResultsRow,
} from "@/queries/logged-results";

export type AdminLoggedResultsProps = {
  competitionId: string;
  format: LoggedFormat;
  config: LoggedConfig;
  scoring: "team" | "individual";
  closed: boolean;
  /** The server's answer: false once Closed (or logging is refused). */
  viewerCanLog: boolean;
  /** The Log button: disabled with its reason once a series is decided or drawn. */
  logOffer: LogOffer | null;
  scoringConfig: ScoringConfig;
  /** Best score's "Max attempts per person"; null for none. */
  maxAttempts: number | null;
  /** Best score: each Participant's Attempts so far, by id. */
  attemptCounts: Record<string, number>;
  /** Ranked best first, each with its points (Best score's table). */
  leaderboard: LoggedResultsRow[];
  /** Newest first, each with whether the viewer may edit or delete it. */
  results: LoggedResultView[];
  /** A Head-to-head's two Entrants, or Best score's Participants. */
  playerOptions: LoggedResultsName[];
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
 * preselected and any player can be picked; the server's rule for
 * logging a Match or Attempt decides what is allowed.
 */
export function AdminLoggedResults({
  competitionId,
  format,
  config,
  scoring,
  closed,
  viewerCanLog,
  logOffer,
  scoringConfig,
  maxAttempts,
  attemptCounts,
  leaderboard,
  results,
  playerOptions,
  primaryColor,
  teamLabel,
  now,
}: AdminLoggedResultsProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResultFormValue | null>(null);
  const bestScore = format === "best-score";
  const noun = resultNoun(format);

  function openForm(result: ResultFormValue | null) {
    setEditing(result);
    setFormOpen(true);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={noun.many}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{noun.many}</h3>
        {logOffer ? (
          <LogButton
            offer={logOffer}
            onLog={() => openForm(null)}
            size="default"
            className="min-h-11 sm:min-h-0"
          />
        ) : null}
      </div>
      {bestScore ? (
        <BestScoreResults
          competitionId={competitionId}
          config={config as BestScoreSettings}
          scoring={scoring}
          closed={closed}
          rows={leaderboard}
          results={results}
          linked={null}
          primaryColor={primaryColor}
          teamLabel={teamLabel}
          now={now}
          onEdit={openForm}
        />
      ) : (
        <MatchLog
          competitionId={competitionId}
          results={results}
          filter="all"
          linked={null}
          now={now}
          onEdit={openForm}
        />
      )}
      {viewerCanLog || results.some((g) => g.canEdit) ? (
        <ResultForm
          open={formOpen}
          onOpenChange={setFormOpen}
          competitionId={competitionId}
          format={format}
          config={config}
          scoringConfig={scoringConfig}
          scoring={scoring}
          playerOptions={playerOptions}
          linked={null}
          runs
          maxAttempts={maxAttempts}
          attemptCounts={attemptCounts}
          result={editing}
        />
      ) : null}
    </section>
  );
}
