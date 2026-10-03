"use client";

import Link from "next/link";
import { useState } from "react";

import {
  finalizeBracket,
  recordHeatResult,
  unfinalizeBracket,
} from "@/actions/brackets";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketTree } from "@/components/bracket-tree";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import {
  HeatResultForm,
  type HeatResultFormProps,
} from "@/components/heat-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isComplete, isRecordable } from "@/lib/bracket/formats";
import type { Bracket } from "@/lib/bracket/types";
import { hasPlacementPoints } from "@/lib/competitions";

type Scoring = "team" | "individual";

/**
 * The admin Bracket's Heat Result form: the Host's record, which asks
 * before resetting later Heats and toasts "<1st place> wins <Heat name>".
 */
function HeatResultSheet({
  competitionId,
  ...props
}: Omit<HeatResultFormProps, "submit" | "confirmResets" | "successToast"> & {
  competitionId: string;
}) {
  return (
    <HeatResultForm
      {...props}
      submit={(result) =>
        recordHeatResult(competitionId, props.heat.id, result)
      }
      confirmResets
      successToast={(winner, heat) => `${winner} wins ${heat}`}
    />
  );
}

/** Finalize's copy: Points Entries are only created with Placement Points. */
export function finalizeCopy(placementPoints: number[] | null) {
  return hasPlacementPoints(placementPoints)
    ? {
        confirmTitle: "Create Points Entries from the final placings?",
        finalizedNote: "Finalized: its Points Entries are in the ledger.",
        unfinalizeTitle: "Delete the Points Entries this Bracket created?",
      }
    : {
        confirmTitle:
          "Finalize the Bracket? It has no Placement Points, so no Points Entries are created.",
        finalizedNote:
          "Finalized: it has no Placement Points, so it made no Points Entries.",
        unfinalizeTitle: "Un-finalize the Bracket?",
      };
}

type BracketAdminProps = {
  competitionId: string;
  /** The Competition's Placement Points; none means Finalize creates no Points Entries. */
  placementPoints: number[] | null;
  scoring: Scoring;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  champion: string | null;
  finalized: boolean;
  primaryColor: string;
  /** The Bracket Finale, once the Bracket is finalized; null before. */
  finaleHref: string | null;
  /** Who self-reported each Heat's current result, by Heat id: a name. */
  reporters?: Record<string, string>;
};

/**
 * Runs a Bracket for an Organizer or the Competition's Host: the champion
 * and Finalize / Un-finalize on top, then the Bracket's tree (the same one
 * Participants see) with Record result (Edit once played) on every Heat
 * that can be recorded while it isn't finalized. A tap opens the Heat
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
 * The admin Bracket for a given open Heat Result (props only). Live
 * refresh runs only while no popup is open, so it never interrupts an
 * unsaved Heat Result.
 */
export function BracketAdminView({
  competitionId,
  placementPoints,
  scoring,
  entrants,
  bracket,
  champion,
  finalized,
  primaryColor,
  finaleHref,
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
  const winner = champion ? entrantsById.get(champion) : undefined;
  const close = () => onOpenHeatChange(null);
  const copy = finalizeCopy(placementPoints);

  return (
    <div className="flex min-w-0 flex-col gap-5">
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
              <span className="flex min-w-0 items-center gap-2 text-lg font-bold">
                <EntrantMark
                  entrant={winner}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
                <span className="truncate">{winner.label}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {finalized ? (
          <>
            <p className="text-foreground/70 text-sm">
              {copy.finalizedNote} Un-finalize to change a Heat Result.
              {finaleHref && (
                <>
                  {" "}
                  <Link
                    href={finaleHref}
                    className="text-primary underline underline-offset-4"
                  >
                    Play the Finale
                  </Link>
                </>
              )}
            </p>
            <ConfirmActionButton
              title={copy.unfinalizeTitle}
              confirmLabel="Un-finalize"
              action={() => unfinalizeBracket(competitionId)}
              successMessage="Bracket un-finalized"
              variant="outline"
              size="lg"
              className="min-h-11"
            >
              Un-finalize
            </ConfirmActionButton>
          </>
        ) : winner && isComplete(bracket) ? (
          // With a 3rd place game, the champion is known before it's played.
          <ConfirmActionButton
            title={copy.confirmTitle}
            confirmLabel="Finalize"
            action={() => finalizeBracket(competitionId)}
            successMessage="Bracket finalized"
            variant="default"
            size="lg"
            className="min-h-11"
          >
            Finalize
          </ConfirmActionButton>
        ) : (
          <>
            <Button type="button" size="lg" className="min-h-11" disabled>
              Finalize
            </Button>
            <p className="text-foreground/70 text-sm">
              Finish every Heat to finalize.
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
          <HeatResultSheet
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
