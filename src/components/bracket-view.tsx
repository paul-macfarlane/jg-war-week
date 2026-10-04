"use client";

import { useState } from "react";

import { clearMatchReport, reportMatchResult } from "@/actions/match-reports";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketPodium } from "@/components/bracket-podium";
import { BracketTree } from "@/components/bracket-tree";
import type { BracketViewEntrant } from "@/components/entrant-mark";
import { MatchResultForm } from "@/components/match-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useYou } from "@/components/you";
import type { PodiumPlace } from "@/lib/bracket/podium";
import type { Bracket } from "@/lib/bracket/types";
import {
  type NextMatch,
  entrantForYou,
  matchName,
  nextMatchFor,
} from "@/lib/bracket/view";
import type { ScoreDirection } from "@/lib/enums";

type Scoring = "team" | "individual";

/** The "You" pill beside Your Entrant. */
export function YouMark() {
  return (
    <span
      data-you
      className="bg-accent text-accent-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
    >
      You
    </span>
  );
}

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * The "Your next Match" card (props only): the Match You play next and
 * against whom, or the Round You advanced to. `canReport` adds **Report
 * result** (the server found the Match reportable by You, known by account
 * linking).
 */
export function YourNextMatchCard({
  next,
  bracket,
  entrantsById,
  canReport,
  onReport,
}: {
  next: NextMatch;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  canReport: boolean;
  onReport: () => void;
}) {
  return (
    <Card size="sm" aria-label="Your next Match" className="ring-accent ring-2">
      <CardContent className="flex min-w-0 flex-col gap-1">
        {next.kind === "advanced" ? (
          <>
            <span className="text-foreground/60 text-xs font-medium uppercase">
              Your next Match
            </span>
            <span className="font-semibold">
              Advanced to Round {next.round} · waiting for Round{" "}
              {next.round - 1} to finish
            </span>
          </>
        ) : (
          <>
            <span className="text-foreground/60 text-xs font-medium uppercase">
              Your next Match · {matchName(bracket, next.match)}
            </span>
            {next.opponentIds.length > 0 ? (
              <span className="font-semibold break-words">
                vs{" "}
                {listNames(
                  next.opponentIds.map(
                    (id) => entrantsById.get(id)?.label ?? "Unknown",
                  ),
                )}
              </span>
            ) : (
              <span className="text-foreground/70">
                {next.waitingFor
                  ? `Waiting for ${matchName(bracket, next.waitingFor)}`
                  : "Waiting for an opponent"}
              </span>
            )}
            {canReport ? (
              <Button
                type="button"
                size="lg"
                className="mt-2 min-h-11 w-fit"
                onClick={onReport}
              >
                Report result
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** What the page decided about self-report for this Bracket. */
export type BracketViewSelfReport = {
  on: boolean;
  /** The Participant the session email links to, or null. */
  linkedParticipantId: string | null;
  /** Your Matches the server found You may record or change now. */
  reportableMatchIds: string[];
  /** Your decided Matches whose result a later Match already used. */
  lockedMatchIds: string[];
};

/**
 * The Competition page's Bracket: Top finishers (the places decided so
 * far, Provisional until it's Closed) and Your next Match pinned on top,
 * then the Bracket's tree (the same one admin records from), Your
 * Entrant highlighted under the You rules. Each Match of yours you may
 * record or change carries Record result (Edit once played) in the tree,
 * and your next one on the card too; one a later Match already used shows
 * Edit disabled with the reason. Owns
 * the report Sheet (a centered Dialog on large screens), and refreshes
 * live while it's closed (a Bracket not drawn yet too, so the draw
 * appears).
 */
export function BracketView({
  competitionId,
  entrants,
  bracket,
  podium,
  closed,
  scoring,
  scoreUnit = null,
  scoreDirection = "none",
  primaryColor,
  participantTeams,
  participantSquads,
  selfReport,
}: {
  competitionId: string;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  /** The places decided so far, with their points (`podium`). */
  podium: PodiumPlace[];
  /** Whether the Bracket is Closed: its podium's points are final. */
  closed: boolean;
  scoring: Scoring;
  /** The Competition's Score unit, for Score labels. */
  scoreUnit?: string | null;
  /** The Score direction: with one, Scores decide a Match's places. */
  scoreDirection?: ScoreDirection;
  primaryColor: string;
  /** Each Participant's Team id, for finding Your Team's Entrant. */
  participantTeams: Record<string, string>;
  /** Each Participant's Squad id in this Competition, for Your Squad's Entrant. */
  participantSquads: Record<string, string>;
  selfReport: BracketViewSelfReport;
}) {
  const you = useYou();
  const [reporting, setReporting] = useState<string | null>(null);
  const entrantsById = new Map(entrants.map((e) => [e.id, e]));
  const youEntrantId = entrantForYou(
    entrants,
    you
      ? {
          participantId: you.participantId,
          teamId: participantTeams[you.participantId] ?? null,
          squadId: participantSquads[you.participantId] ?? null,
        }
      : null,
    scoring,
  );
  const next = youEntrantId ? nextMatchFor(bracket, youEntrantId) : null;
  const matchesById = new Map(bracket.matches.map((h) => [h.id, h]));
  const mine =
    selfReport.on && you?.participantId === selfReport.linkedParticipantId;
  const reportable = mine ? selfReport.reportableMatchIds : [];
  const canReport =
    next?.kind === "match" && reportable.includes(next.match.id);
  const reportMatch = reporting ? matchesById.get(reporting) : undefined;
  const close = () => setReporting(null);
  const squadHelp = entrants.some((e) => e.squadId) ? (
    <p className="text-foreground/70 text-sm">
      <span className="font-medium">Squad</span>: a pair or group from one Team,
      playing as one entrant
    </p>
  ) : null;

  if (bracket.matches.length === 0) {
    return (
      <section className="flex flex-col gap-2" aria-label="Bracket">
        <h2 className="text-lg font-semibold">Bracket</h2>
        {squadHelp}
        <p className="text-foreground/70 text-sm">
          The Bracket hasn&apos;t been drawn yet.
        </p>
        <AutoRefresh />
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="Bracket">
      <h2 className="text-lg font-semibold">Bracket</h2>
      {squadHelp}

      <BracketPodium
        places={podium}
        entrantsById={entrantsById}
        scoring={scoring}
        primaryColor={primaryColor}
        closed={closed}
        after={(id) => (id === youEntrantId ? <YouMark /> : null)}
      />

      {next && (
        <YourNextMatchCard
          next={next}
          bracket={bracket}
          entrantsById={entrantsById}
          canReport={canReport}
          onReport={() => {
            if (next.kind === "match") setReporting(next.match.id);
          }}
        />
      )}

      <BracketTree
        bracket={bracket}
        entrantsById={entrantsById}
        scoring={scoring}
        scoreUnit={scoreUnit}
        scoreDirection={scoreDirection}
        primaryColor={primaryColor}
        youEntrantId={youEntrantId}
        recordableMatchIds={reportable}
        lockedMatchIds={mine ? selfReport.lockedMatchIds : []}
        onRecord={setReporting}
      />

      <ResponsiveSheetDialog
        open={reportMatch !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {reportMatch && (
          <MatchResultForm
            key={reportMatch.id}
            match={reportMatch}
            bracket={bracket}
            entrantsById={entrantsById}
            scoring={scoring}
            scoreUnit={scoreUnit}
            scoreDirection={scoreDirection}
            primaryColor={primaryColor}
            submit={(result) =>
              reportMatchResult(competitionId, reportMatch.id, result)
            }
            clear={() => clearMatchReport(competitionId, reportMatch.id)}
            successToast={() => "Result reported."}
            onSaved={close}
          />
        )}
      </ResponsiveSheetDialog>

      {reportMatch === undefined && <AutoRefresh />}
    </section>
  );
}
