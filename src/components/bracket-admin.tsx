"use client";

import { useState } from "react";

import {
  clearMatchResult,
  closeBracket,
  recordMatchResult,
  reopenBracket,
} from "@/actions/brackets";
import { AutoRefresh } from "@/components/auto-refresh";
import { BracketPodium } from "@/components/bracket-podium";
import { BracketRoundEditor } from "@/components/bracket-round-editor";
import { BracketTree } from "@/components/bracket-tree";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import type { BracketViewEntrant } from "@/components/entrant-mark";
import {
  MatchResultForm,
  type MatchResultFormProps,
} from "@/components/match-result-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { isHeadToHead } from "@/lib/bracket/config";
import { isComplete, isRecordable } from "@/lib/bracket/formats";
import type { PodiumPlace } from "@/lib/bracket/podium";
import { usedLater } from "@/lib/bracket/self-report";
import type { Bracket } from "@/lib/bracket/types";
import { hasPlacementPoints } from "@/lib/competitions";
import type { ScoreDirection } from "@/lib/enums";

type Scoring = "team" | "individual";

/**
 * The admin Bracket's Match result form: the Host's record, toasting
 * "<1st place> wins <Match name>", with Clear result once decided.
 */
function MatchResultSheet({
  competitionId,
  ...props
}: Omit<MatchResultFormProps, "submit" | "clear" | "successToast"> & {
  competitionId: string;
}) {
  return (
    <MatchResultForm
      {...props}
      submit={(result) =>
        recordMatchResult(competitionId, props.match.id, result)
      }
      clear={() => clearMatchResult(competitionId, props.match.id)}
      successToast={(winner, match) => `${winner} wins ${match}`}
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
  /** The Competition's Score unit, for Score labels. */
  scoreUnit?: string | null;
  /** The Score direction: with one, Scores decide a Match's places. */
  scoreDirection?: ScoreDirection;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  /** The Winner's Entrant id, once the final is decided. */
  winner: string | null;
  /** The places decided so far, with their points (`podium`). */
  podium: PodiumPlace[];
  closed: boolean;
  primaryColor: string;
  /** Who self-reported each Match's current result, by Match id: a name. */
  reporters?: Record<string, string>;
};

/**
 * Runs a Bracket for an Organizer or the Competition's Host: Top finishers
 * and Close / Reopen on top, then the Bracket's tree (the same one
 * Participants see) with Record result (Edit once played) on every Match
 * that can be recorded while it isn't Closed, and Edit disabled with the
 * reason on a Match a later Match already used. A tap opens the Match
 * Result popup, a bottom Sheet on a phone and a centered Dialog on large
 * screens (`ResponsiveSheetDialog`). A Group Bracket's Round headings each
 * carry an Edit that opens that Round's editor (`BracketRoundEditor`) the
 * same way. Refreshes live while no popup is open.
 */
export function BracketAdmin(props: BracketAdminProps) {
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);
  const [editRound, setEditRound] = useState<number | null>(null);
  return (
    <BracketAdminView
      {...props}
      openMatchId={openMatchId}
      onOpenMatchChange={setOpenMatchId}
      editRound={editRound}
      onEditRoundChange={setEditRound}
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
  scoreUnit = null,
  scoreDirection = "none",
  entrants,
  bracket,
  winner,
  podium,
  closed,
  primaryColor,
  reporters = {},
  openMatchId,
  onOpenMatchChange,
  editRound = null,
  onEditRoundChange,
}: BracketAdminProps & {
  openMatchId: string | null;
  onOpenMatchChange: (matchId: string | null) => void;
  /** The Group Bracket Round being edited, if any. */
  editRound?: number | null;
  onEditRoundChange?: (round: number | null) => void;
}) {
  const entrantsById = new Map(entrants.map((e) => [e.id, e]));
  const resultMatch = openMatchId
    ? bracket.matches.find((h) => h.id === openMatchId)
    : undefined;
  const close = () => onOpenMatchChange(null);
  // A Round an edit took away (it became the final's) closes its editor.
  const roundShown =
    editRound !== null &&
    !closed &&
    bracket.matches.some((h) => h.round === editRound)
      ? editRound
      : null;
  const copy = closeCopy(placementPoints);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <BracketPodium
        places={podium}
        entrantsById={entrantsById}
        scoring={scoring}
        primaryColor={primaryColor}
        closed={closed}
      />

      <div className="flex flex-wrap items-center gap-3">
        {closed ? (
          <>
            <p className="text-foreground/70 text-sm">
              {copy.closedNote} Reopen it to change a Match result.
            </p>
            <ConfirmActionButton
              title={copy.reopenTitle}
              confirmLabel="Reopen"
              action={() => reopenBracket(competitionId)}
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
            action={() => closeBracket(competitionId)}
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

      {bracket.matches.length === 0 && (
        <p className="text-foreground/70 text-sm">
          No Bracket yet. Generate it in the builder first.
        </p>
      )}

      <BracketTree
        bracket={bracket}
        entrantsById={entrantsById}
        scoring={scoring}
        scoreUnit={scoreUnit}
        scoreDirection={scoreDirection}
        primaryColor={primaryColor}
        recordableMatchIds={
          closed
            ? []
            : bracket.matches
                .filter(
                  (h) => isRecordable(bracket, h.id) && !usedLater(bracket, h),
                )
                .map((h) => h.id)
        }
        lockedMatchIds={
          closed
            ? []
            : bracket.matches
                .filter(
                  (h) => isRecordable(bracket, h.id) && usedLater(bracket, h),
                )
                .map((h) => h.id)
        }
        onRecord={onOpenMatchChange}
        onEditRound={
          closed || isHeadToHead(bracket.config) ? undefined : onEditRoundChange
        }
        reporters={reporters}
      />

      <ResponsiveSheetDialog
        open={roundShown !== null}
        onOpenChange={(open) => {
          if (!open) onEditRoundChange?.(null);
        }}
      >
        {roundShown !== null && (
          <BracketRoundEditor
            key={roundShown}
            competitionId={competitionId}
            bracket={bracket}
            round={roundShown}
            entrantsById={entrantsById}
          />
        )}
      </ResponsiveSheetDialog>

      <ResponsiveSheetDialog
        open={resultMatch !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {resultMatch && (
          <MatchResultSheet
            key={resultMatch.id}
            competitionId={competitionId}
            match={resultMatch}
            bracket={bracket}
            entrantsById={entrantsById}
            scoring={scoring}
            scoreUnit={scoreUnit}
            scoreDirection={scoreDirection}
            primaryColor={primaryColor}
            onSaved={close}
          />
        )}
      </ResponsiveSheetDialog>

      {openMatchId === null && editRound === null && <AutoRefresh />}
    </div>
  );
}
