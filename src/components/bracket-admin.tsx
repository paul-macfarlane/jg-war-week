"use client";

import { useState } from "react";

import {
  finalizeBracket,
  recordHeatResult,
  unfinalizeBracket,
} from "@/actions/brackets";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketPodium } from "@/components/bracket-podium";
import { BracketTree } from "@/components/bracket-tree";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import type { BracketViewEntrant } from "@/components/entrant-mark";
import {
  MatchResultForm,
  type MatchResultFormProps,
} from "@/components/match-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { isComplete, isRecordable } from "@/lib/bracket/formats";
import type { PodiumPlace } from "@/lib/bracket/podium";
import type { Bracket } from "@/lib/bracket/types";
import { hasPlacementPoints } from "@/lib/competitions";

type Scoring = "team" | "individual";

/**
 * The admin Bracket's Match result form: the Host's record, which asks
 * before resetting later Matches and toasts "<1st place> wins <Match name>".
 */
function MatchResultSheet({
  competitionId,
  ...props
}: Omit<MatchResultFormProps, "submit" | "confirmResets" | "successToast"> & {
  competitionId: string;
}) {
  return (
    <MatchResultForm
      {...props}
      submit={(result) =>
        recordHeatResult(competitionId, props.heat.id, result)
      }
      confirmResets
      successToast={(winner, heat) => `${winner} wins ${heat}`}
    />
  );
}

/** Close's copy: Points Entries are only created with Placement Points. */
export function closeCopy(placementPoints: number[] | null) {
  return hasPlacementPoints(placementPoints)
    ? {
        confirmTitle: "Create Points Entries from the final placings?",
        closedNote: "Closed: its Points Entries are in the Standings.",
        reopenTitle: "Delete the Points Entries this Bracket created?",
      }
    : {
        confirmTitle:
          "Close the Bracket? It has no Placement Points, so no Points Entries are created.",
        closedNote:
          "Closed: it has no Placement Points, so it made no Points Entries.",
        reopenTitle: "Reopen the Bracket?",
      };
}

type BracketAdminProps = {
  competitionId: string;
  /** The Competition's Placement Points; none means Close creates no Points Entries. */
  placementPoints: number[] | null;
  scoring: Scoring;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  /** The Winner's Entrant id, once the final is decided. */
  winner: string | null;
  /** The places decided so far, with their points (`podium`). */
  podium: PodiumPlace[];
  finalized: boolean;
  primaryColor: string;
  /** Who self-reported each Match's current result, by Match id: a name. */
  reporters?: Record<string, string>;
};

/**
 * Runs a Bracket for an Organizer or the Competition's Host: Top finishers
 * and Close / Reopen on top, then the Bracket's tree (the same one
 * Participants see) with Record result (Edit once played) on every Match
 * that can be recorded while it isn't Closed. A tap opens the Match
 * Result popup, a bottom Sheet on a phone and a centered Dialog on large
 * screens (`ResponsiveSheetDialog`). Refreshes live while no popup is open.
 */
export function BracketAdmin(props: BracketAdminProps) {
  const [openHeatId, setOpenHeatId] = useState<string | null>(null);
  return (
    <BracketAdminView
      {...props}
      openHeatId={openHeatId}
      onOpenHeatChange={setOpenHeatId}
    />
  );
}

/**
 * The admin Bracket for a given open Match result (props only). Live
 * refresh runs only while no popup is open, so it never interrupts an
 * unsaved Match result.
 */
export function BracketAdminView({
  competitionId,
  placementPoints,
  scoring,
  entrants,
  bracket,
  winner,
  podium,
  finalized,
  primaryColor,
  reporters = {},
  openHeatId,
  onOpenHeatChange,
}: BracketAdminProps & {
  openHeatId: string | null;
  onOpenHeatChange: (heatId: string | null) => void;
}) {
  const entrantsById = new Map(entrants.map((e) => [e.id, e]));
  const resultHeat = openHeatId
    ? bracket.heats.find((h) => h.id === openHeatId)
    : undefined;
  const close = () => onOpenHeatChange(null);
  const copy = closeCopy(placementPoints);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <BracketPodium
        places={podium}
        entrantsById={entrantsById}
        scoring={scoring}
        primaryColor={primaryColor}
        closed={finalized}
      />

      <div className="flex flex-wrap items-center gap-3">
        {finalized ? (
          <>
            <p className="text-foreground/70 text-sm">
              {copy.closedNote} Reopen it to change a Match result.
            </p>
            <ConfirmActionButton
              title={copy.reopenTitle}
              confirmLabel="Reopen"
              action={() => unfinalizeBracket(competitionId)}
              successMessage="Bracket reopened"
              variant="outline"
              size="lg"
              className="min-h-11"
            >
              Reopen
            </ConfirmActionButton>
          </>
        ) : winner && isComplete(bracket) ? (
          // With a 3rd place Match, the Winner is known before it's played.
          <ConfirmActionButton
            title={copy.confirmTitle}
            confirmLabel="Close"
            action={() => finalizeBracket(competitionId)}
            successMessage="Bracket closed"
            variant="default"
            size="lg"
            className="min-h-11"
          >
            Close
          </ConfirmActionButton>
        ) : (
          <>
            <Button type="button" size="lg" className="min-h-11" disabled>
              Close
            </Button>
            <p className="text-foreground/70 text-sm">
              Finish every Match to close.
            </p>
          </>
        )}
      </div>

      {bracket.heats.length === 0 && (
        <p className="text-foreground/70 text-sm">
          No Bracket yet. Generate it in the builder first.
        </p>
      )}

      <BracketTree
        bracket={bracket}
        entrantsById={entrantsById}
        scoring={scoring}
        primaryColor={primaryColor}
        recordableHeatIds={
          finalized
            ? []
            : bracket.heats
                .filter((h) => isRecordable(bracket, h.id))
                .map((h) => h.id)
        }
        onRecord={onOpenHeatChange}
        reporters={reporters}
      />

      <ResponsiveSheetDialog
        open={resultHeat !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {resultHeat && (
          <MatchResultSheet
            key={resultHeat.id}
            competitionId={competitionId}
            heat={resultHeat}
            bracket={bracket}
            entrantsById={entrantsById}
            scoring={scoring}
            primaryColor={primaryColor}
            onSaved={close}
          />
        )}
      </ResponsiveSheetDialog>

      {openHeatId === null && <AutoRefresh />}
    </div>
  );
}
