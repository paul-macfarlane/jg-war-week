"use client";

import Link from "next/link";
import { useState } from "react";

import {
  finalizeBracket,
  recordHeatResult,
  unfinalizeBracket,
} from "@/actions/brackets";
import { AutoRefresh } from "@/components/auto-refresh";
import { HeatRows } from "@/components/bracket-view";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import {
  HeatResultForm,
  type HeatResultFormProps,
} from "@/components/heat-result-form";
import { HeatScheduleForm } from "@/components/heat-schedule-form";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isBye, isRecordable } from "@/lib/bracket/formats";
import type { Bracket } from "@/lib/bracket/types";
import {
  formatHeatWhen,
  groupRounds,
  heatName,
  isDecided,
} from "@/lib/bracket/view";

type Scoring = "team" | "individual";

/**
 * The results screen's Heat Result form: the Host's record, which asks
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

/** Which Sheet is open, for which Heat: a Heat Result or its time and place. */
export type OpenSheet = { kind: "result" | "schedule"; heatId: string } | null;

type BracketResultsProps = {
  competitionId: string;
  scoring: Scoring;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  champion: string | null;
  finalized: boolean;
  primaryColor: string;
  /** The War Week's Days, for a Heat's time and place. */
  days: { id: string; date: string }[];
  /** The Bracket Finale, once the Bracket is finalized; null before. */
  finaleHref: string | null;
  /** Who self-reported each Heat's current result, by Heat id: a name. */
  reporters?: Record<string, string>;
};

/**
 * Runs a Bracket on a phone: Heats by Round as Cards, a tap opens the Heat
 * Result popup, "Time & place" opens the Heat's time popup — both a bottom
 * Sheet on a phone and a centered Dialog on large screens
 * (`ResponsiveSheetDialog`); the champion and Finalize / Un-finalize sit on
 * top. Refreshes live while no popup is open.
 */
export function BracketResults(props: BracketResultsProps) {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  return (
    <BracketResultsView
      {...props}
      openSheet={openSheet}
      onOpenSheetChange={setOpenSheet}
    />
  );
}

/**
 * The results screen for a given open Sheet (props only). Live refresh runs
 * only while no Sheet is open, so it never interrupts an unsaved Heat
 * Result or time.
 */
export function BracketResultsView({
  competitionId,
  scoring,
  entrants,
  bracket,
  champion,
  finalized,
  primaryColor,
  days,
  finaleHref,
  reporters = {},
  openSheet,
  onOpenSheetChange,
}: BracketResultsProps & {
  openSheet: OpenSheet;
  onOpenSheetChange: (openSheet: OpenSheet) => void;
}) {
  const entrantsById = new Map(entrants.map((e) => [e.id, e]));
  const sheetHeat = openSheet
    ? bracket.heats.find((h) => h.id === openSheet.heatId)
    : undefined;
  const resultHeat = openSheet?.kind === "result" ? sheetHeat : undefined;
  const scheduleHeat = openSheet?.kind === "schedule" ? sheetHeat : undefined;
  const winner = champion ? entrantsById.get(champion) : undefined;
  const close = () => onOpenSheetChange(null);

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
              Finalized: its Points Entries are in the ledger. Un-finalize to
              change a Heat Result.
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
              title="Delete the Points Entries this Bracket created?"
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
        ) : winner ? (
          <ConfirmActionButton
            title="Create Points Entries from the final placings?"
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

      {groupRounds(bracket).map((round) => (
        <section
          key={round.round}
          className="flex flex-col gap-2"
          aria-label={round.name}
        >
          <h2 className="font-semibold">{round.name}</h2>
          <ul className="flex flex-col gap-2">
            {round.heats.map((heat) => {
              const name = heatName(bracket, heat);
              const tappable = !finalized && isRecordable(bracket, heat.id);
              const schedulable = !finalized && !isBye(bracket, heat);
              const when = formatHeatWhen(heat, days);
              const reporter = reporters[heat.id];
              const rows = (
                <HeatRows
                  heat={heat}
                  bracket={bracket}
                  entrantsById={entrantsById}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
              );
              return (
                <li key={heat.id}>
                  <Card size="sm" className="relative">
                    <CardContent className="flex min-w-0 flex-col gap-2">
                      <div className="text-foreground/60 flex min-h-8 items-center justify-between gap-2 text-xs font-medium">
                        <span>{name}</span>
                        <span className="flex items-center gap-2">
                          {tappable && (
                            <span className="text-primary">
                              {isDecided(heat) ? "Edit" : "Record result"}
                            </span>
                          )}
                          {schedulable && (
                            // Above the full-card overlay, so it opens its
                            // own Sheet rather than the Heat Result.
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Time & place for ${name}`}
                              className="relative z-10 min-h-11 sm:min-h-8"
                              onClick={() =>
                                onOpenSheetChange({
                                  kind: "schedule",
                                  heatId: heat.id,
                                })
                              }
                            >
                              Time &amp; place
                            </Button>
                          )}
                        </span>
                      </div>
                      {when && (
                        <span className="text-foreground/70 text-xs">
                          {when}
                        </span>
                      )}
                      {rows}
                      {reporter && (
                        <span className="text-foreground/60 text-xs">
                          Reported by {reporter}
                        </span>
                      )}
                    </CardContent>
                    {tappable && (
                      // Covers the Card, so the whole Heat is one tap target.
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`${isDecided(heat) ? "Edit" : "Record"} ${name}`}
                        className="focus-visible:ring-ring/50 absolute inset-0 size-auto rounded-xl border-0 bg-transparent p-0 outline-none hover:bg-transparent focus-visible:ring-3 active:translate-y-0"
                        onClick={() =>
                          onOpenSheetChange({ kind: "result", heatId: heat.id })
                        }
                      />
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

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

      <ResponsiveSheetDialog
        open={scheduleHeat !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        {scheduleHeat && (
          <HeatScheduleForm
            key={scheduleHeat.id}
            competitionId={competitionId}
            heat={scheduleHeat}
            name={heatName(bracket, scheduleHeat)}
            days={days}
            onSaved={close}
          />
        )}
      </ResponsiveSheetDialog>

      {openSheet === null && <AutoRefresh />}
    </div>
  );
}
