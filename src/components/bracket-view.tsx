"use client";

import { useState } from "react";

import { reportHeatResult } from "@/actions/heat-reports";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketPodium } from "@/components/bracket-podium";
import { BracketTree } from "@/components/bracket-tree";
import type { BracketViewEntrant } from "@/components/entrant-mark";
import { HeatResultForm } from "@/components/heat-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useYou } from "@/components/you";
import type { PodiumPlace } from "@/lib/bracket/podium";
import type { Bracket } from "@/lib/bracket/types";
import {
  type NextHeat,
  entrantForYou,
  heatName,
  nextHeatFor,
} from "@/lib/bracket/view";

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
export function YourNextHeatCard({
  next,
  bracket,
  entrantsById,
  canReport,
  onReport,
}: {
  next: NextHeat;
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
              Your next Match · {heatName(bracket, next.heat)}
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
                  ? `Waiting for ${heatName(bracket, next.waitingFor)}`
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
  /** Your next Heat, when the server found it reportable by You; else null. */
  reportableHeatId: string | null;
};

/**
 * The Competition page's Bracket: Top finishers (the places decided so
 * far, Provisional until it's Closed) and Your next Match pinned on top,
 * then the Bracket's tree (the same one admin records from), Your
 * Entrant highlighted under the You rules. Your Heat, when you may
 * self-report it, carries Record result in the tree as on the card. Owns
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
  const next = youEntrantId ? nextHeatFor(bracket, youEntrantId) : null;
  const heatsById = new Map(bracket.heats.map((h) => [h.id, h]));
  const canReport =
    selfReport.on &&
    you?.participantId === selfReport.linkedParticipantId &&
    next?.kind === "heat" &&
    next.heat.id === selfReport.reportableHeatId;
  const reportHeat = reporting ? heatsById.get(reporting) : undefined;
  const close = () => setReporting(null);
  const squadHelp = entrants.some((e) => e.squadId) ? (
    <p className="text-foreground/70 text-sm">
      <span className="font-medium">Squad</span>: a pair or group from one Team,
      playing as one entrant
    </p>
  ) : null;

  if (bracket.heats.length === 0) {
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
        <YourNextHeatCard
          next={next}
          bracket={bracket}
          entrantsById={entrantsById}
          canReport={canReport}
          onReport={() => {
            if (next.kind === "heat") setReporting(next.heat.id);
          }}
        />
      )}

      <BracketTree
        bracket={bracket}
        entrantsById={entrantsById}
        scoring={scoring}
        primaryColor={primaryColor}
        youEntrantId={youEntrantId}
        recordableHeatIds={
          canReport && selfReport.reportableHeatId
            ? [selfReport.reportableHeatId]
            : []
        }
        onRecord={setReporting}
      />

      <ResponsiveSheetDialog
        open={reportHeat !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {reportHeat && (
          <HeatResultForm
            key={reportHeat.id}
            heat={reportHeat}
            bracket={bracket}
            entrantsById={entrantsById}
            scoring={scoring}
            primaryColor={primaryColor}
            submit={(result) =>
              reportHeatResult(competitionId, reportHeat.id, result)
            }
            confirmResets={false}
            successToast={() => "Result reported."}
            onSaved={close}
          />
        )}
      </ResponsiveSheetDialog>

      {reportHeat === undefined && <AutoRefresh />}
    </section>
  );
}
