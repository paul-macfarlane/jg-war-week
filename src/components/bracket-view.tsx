"use client";

import Link from "next/link";
import { useState } from "react";

import { reportHeatResult } from "@/actions/heat-reports";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketTree } from "@/components/bracket-tree";
import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import { HeatResultForm } from "@/components/heat-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useYou } from "@/components/you";
import type { Bracket } from "@/lib/bracket/types";
import {
  type NextHeat,
  entrantForYou,
  heatName,
  nextHeatFor,
} from "@/lib/bracket/view";
import { YOU_ROW_CLASS } from "@/lib/you";

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
 * The "Your next Heat" card (props only): the Heat You play next and
 * against whom, or the Round You advanced to. `canReport` adds **Report
 * result** (the server found the Heat reportable by You, known by account
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
    <Card size="sm" aria-label="Your next Heat" className="ring-accent ring-2">
      <CardContent className="flex min-w-0 flex-col gap-1">
        {next.kind === "advanced" ? (
          <>
            <span className="text-foreground/60 text-xs font-medium uppercase">
              Your next Heat
            </span>
            <span className="font-semibold">
              Advanced to Round {next.round} · waiting for Round{" "}
              {next.round - 1} to finish
            </span>
          </>
        ) : (
          <>
            <span className="text-foreground/60 text-xs font-medium uppercase">
              Your next Heat · {heatName(bracket, next.heat)}
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
 * The Competition page's Bracket: the champion and Your next Heat pinned on
 * top, then the Bracket's tree (the same one admin records from), Your
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
  champion,
  scoring,
  primaryColor,
  participantTeams,
  participantSquads,
  finaleHref,
  selfReport,
}: {
  competitionId: string;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  champion: string | null;
  scoring: Scoring;
  primaryColor: string;
  /** Each Participant's Team id, for finding Your Team's Entrant. */
  participantTeams: Record<string, string>;
  /** Each Participant's Squad id in this Competition, for Your Squad's Entrant. */
  participantSquads: Record<string, string>;
  /** The Bracket Finale, once the Bracket is finalized; null before. */
  finaleHref: string | null;
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
  const winner = champion ? entrantsById.get(champion) : undefined;
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

      {winner && (
        <Card size="sm" aria-label="Champion" className="ring-primary ring-2">
          <CardContent className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="text-3xl">
              🏆
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground/60 text-xs font-medium uppercase">
                Champion
              </span>
              <span
                className={`flex min-w-0 items-center gap-2 text-lg font-bold ${YOU_ROW_CLASS}`}
              >
                <EntrantMark
                  entrant={winner}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
                <span className="truncate">{winner.label}</span>
                {winner.id === youEntrantId && <YouMark />}
              </span>
            </div>
            {finaleHref && (
              <Link
                href={finaleHref}
                className={`${buttonVariants({ variant: "outline", size: "sm" })} ml-auto shrink-0`}
              >
                Play the Finale
              </Link>
            )}
          </CardContent>
        </Card>
      )}

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
