"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  finalizeBracket,
  recordHeatResult,
  unfinalizeBracket,
} from "@/actions/brackets";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  type BracketViewEntrant,
  EntrantMark,
  HeatRows,
} from "@/components/bracket-view";
import {
  ConfirmActionButton,
  ConfirmDialog,
} from "@/components/confirm-dialog";
import { HeatScheduleForm } from "@/components/heat-schedule-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { isBye, isRecordable, resetByResult } from "@/lib/bracket/formats";
import type { Bracket, Heat, HeatResult } from "@/lib/bracket/types";
import {
  formatHeatWhen,
  groupRounds,
  heatName,
  isDecided,
} from "@/lib/bracket/view";

type Scoring = "team" | "individual";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

type HeatResultFormProps = {
  competitionId: string;
  heat: Heat;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  onSaved: () => void;
};

/**
 * Saving a Heat Result from either Sheet: the later Heats it would reset
 * (named, for the confirm), and a `save` that records it and toasts
 * "<1st place> wins <Heat name>".
 */
function useSaveHeatResult(
  { competitionId, heat, bracket, entrantsById, onSaved }: HeatResultFormProps,
  result: HeatResult | null,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = heatName(bracket, heat);
  const label = (entrantId: string) =>
    entrantsById.get(entrantId)?.label ?? "Unknown";
  const resetNames = (
    result ? resetByResult(bracket, heat.id, result) : []
  ).map((resetId) =>
    heatName(
      bracket,
      bracket.heats.find((h) => h.id === resetId)!,
    ),
  );

  function save() {
    if (!result) return;
    const forfeits = new Set(result.forfeits ?? []);
    const first = result.order.find((id) => !forfeits.has(id))!;
    startTransition(async () => {
      const saved = await recordHeatResult(competitionId, heat.id, result);
      setConfirmOpen(false);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      const reset = saved.resetHeatIds.length;
      toast.success(
        `${label(first)} wins ${name}` +
          (reset > 0
            ? ` · ${plural(reset, "later Heat", "later Heats")} reset`
            : ""),
      );
      onSaved();
      router.refresh();
    });
  }

  const saveButton = (
    <SheetFooter>
      <Button
        type="button"
        size="lg"
        className="min-h-11"
        disabled={!result || pending}
        onClick={() => (resetNames.length > 0 ? setConfirmOpen(true) : save())}
      >
        {pending ? "Saving…" : "Save Heat Result"}
      </Button>
    </SheetFooter>
  );
  const confirm = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={`Change the ${name} result?`}
      description={resetNames.map((reset) => (
        <span key={reset} className="block">
          {reset} will be reset.
        </span>
      ))}
      confirmLabel="Save and reset"
      pending={pending}
      onConfirm={save}
    />
  );
  return { name, label, saveButton, confirm };
}

/** The scores typed so far, without the empty ones. */
function filledScores(scores: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(scores).filter(([, score]) => score.trim() !== ""),
  );
}

/** A score input for one Entrant. */
function ScoreField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="min-w-0 break-words">
        {label} score
      </FieldLabel>
      <Input
        id={id}
        maxLength={40}
        placeholder="Optional, e.g. 21 or 1:32.4"
        className="h-11 sm:h-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** A Forfeit switch for one Entrant. */
function ForfeitField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="min-h-11 sm:min-h-9">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <FieldLabel htmlFor={id} className="min-w-0 break-words">
        {label} forfeits
      </FieldLabel>
    </Field>
  );
}

/**
 * The Heat Result form for a two-slot Heat: tap the winner, optional
 * scores, a Forfeit switch per Entrant. Changing the winner of a Heat whose
 * later Heats have results asks first, naming them; a score-only edit
 * doesn't ask.
 */
function WinnerForm(props: HeatResultFormProps) {
  const { heat, entrantsById, scoring, primaryColor } = props;
  const id = useId();
  const ids = heat.slots.map((s) => s.entrantId!);
  const decided = isDecided(heat);
  const [winner, setWinner] = useState<string | null>(
    decided ? (heat.slots.find((s) => s.place === 1)?.entrantId ?? null) : null,
  );
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(heat.slots.map((s) => [s.entrantId!, s.score ?? ""])),
  );
  const [forfeit, setForfeit] = useState<string | null>(
    heat.slots.find((s) => s.forfeited)?.entrantId ?? null,
  );
  const result: HeatResult | null = winner
    ? {
        order: [winner, ...ids.filter((e) => e !== winner)],
        scores: filledScores(scores),
        forfeits: forfeit ? [forfeit] : [],
      }
    : null;
  const { name, label, saveButton, confirm } = useSaveHeatResult(props, result);

  function toggleForfeit(entrantId: string, on: boolean) {
    setForfeit(on ? entrantId : null);
    // A forfeiting Entrant loses, so the other one wins.
    if (on) setWinner(ids.find((other) => other !== entrantId) ?? null);
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{name}</SheetTitle>
        <SheetDescription>
          Tap the winner. Scores are optional.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div
          role="group"
          aria-label="Winner"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {ids.map((entrantId) => {
            const entrant = entrantsById.get(entrantId)!;
            const chosen = winner === entrantId;
            return (
              <Button
                key={entrantId}
                type="button"
                variant={chosen ? "default" : "outline"}
                aria-pressed={chosen}
                className="h-auto min-h-11 justify-start gap-2 py-2"
                onClick={() => {
                  setWinner(entrantId);
                  if (forfeit === entrantId) setForfeit(null);
                }}
              >
                <EntrantMark
                  entrant={entrant}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
                <span className="min-w-0 truncate">{entrant.label}</span>
                {chosen && <span className="ml-auto">✓ Winner</span>}
              </Button>
            );
          })}
        </div>
        <FieldGroup className="gap-4">
          {ids.map((entrantId, i) => (
            <div key={entrantId} className="flex flex-col gap-2">
              <ScoreField
                id={`${id}-score-${i}`}
                label={label(entrantId)}
                value={scores[entrantId] ?? ""}
                onChange={(value) =>
                  setScores((s) => ({ ...s, [entrantId]: value }))
                }
              />
              <ForfeitField
                id={`${id}-forfeit-${i}`}
                label={label(entrantId)}
                checked={forfeit === entrantId}
                onCheckedChange={(on) => toggleForfeit(entrantId, on)}
              />
            </div>
          ))}
        </FieldGroup>
      </div>
      {saveButton}
      {confirm}
    </>
  );
}

/**
 * The Heat Result form for a Heat of more than two: tap the Entrants in
 * finishing order (each shows its place), Undo the last tap, optional
 * scores, and a Forfeit switch per Entrant; forfeiters aren't tapped and
 * finish last. A result that changes who advances from a complete Round
 * asks first, naming the later Heats it resets.
 */
function FinishingOrderForm(props: HeatResultFormProps) {
  const { heat, entrantsById, scoring, primaryColor } = props;
  const id = useId();
  const ids = heat.slots.map((s) => s.entrantId!);
  const decided = isDecided(heat);
  const [forfeits, setForfeits] = useState<string[]>(() =>
    heat.slots.filter((s) => s.forfeited).map((s) => s.entrantId!),
  );
  const [order, setOrder] = useState<string[]>(() =>
    decided
      ? heat.slots
          .filter((s) => !s.forfeited)
          .sort((a, b) => (a.place ?? 0) - (b.place ?? 0))
          .map((s) => s.entrantId!)
      : [],
  );
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(heat.slots.map((s) => [s.entrantId!, s.score ?? ""])),
  );
  const toPlace = ids.filter((e) => !forfeits.includes(e));
  const complete = order.length > 0 && order.length === toPlace.length;
  const result: HeatResult | null = complete
    ? {
        order: [...order, ...ids.filter((e) => forfeits.includes(e))],
        scores: filledScores(scores),
        forfeits,
      }
    : null;
  const { name, label, saveButton, confirm } = useSaveHeatResult(props, result);

  function toggleForfeit(entrantId: string, on: boolean) {
    setForfeits((f) =>
      on ? [...f, entrantId] : f.filter((e) => e !== entrantId),
    );
    // A forfeiter finishes last, so it leaves the tapped order.
    if (on) setOrder((o) => o.filter((e) => e !== entrantId));
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{name}</SheetTitle>
        <SheetDescription>
          Tap the Entrants in finishing order, 1st first. Forfeiters finish
          last. Scores are optional.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div
          role="group"
          aria-label="Finishing order"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {ids.map((entrantId) => {
            const entrant = entrantsById.get(entrantId)!;
            const place = order.indexOf(entrantId) + 1;
            const forfeited = forfeits.includes(entrantId);
            return (
              <Button
                key={entrantId}
                type="button"
                variant={place > 0 ? "default" : "outline"}
                aria-pressed={place > 0}
                disabled={forfeited}
                className="h-auto min-h-11 justify-start gap-2 py-2"
                onClick={() => {
                  if (place === 0) setOrder((o) => [...o, entrantId]);
                }}
              >
                <EntrantMark
                  entrant={entrant}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
                <span className="min-w-0 truncate">{entrant.label}</span>
                {place > 0 && (
                  <span
                    aria-label={`Place ${place}`}
                    className="bg-primary-foreground text-primary ml-auto flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums"
                  >
                    {place}
                  </span>
                )}
                {forfeited && <span className="ml-auto shrink-0">Forfeit</span>}
              </Button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 w-fit"
          disabled={order.length === 0}
          onClick={() => setOrder((o) => o.slice(0, -1))}
        >
          Undo
        </Button>
        <FieldGroup className="gap-4">
          {ids.map((entrantId, i) => (
            <div key={entrantId} className="flex flex-col gap-2">
              <ScoreField
                id={`${id}-score-${i}`}
                label={label(entrantId)}
                value={scores[entrantId] ?? ""}
                onChange={(value) =>
                  setScores((s) => ({ ...s, [entrantId]: value }))
                }
              />
              <ForfeitField
                id={`${id}-forfeit-${i}`}
                label={label(entrantId)}
                checked={forfeits.includes(entrantId)}
                onCheckedChange={(on) => toggleForfeit(entrantId, on)}
              />
            </div>
          ))}
        </FieldGroup>
      </div>
      {saveButton}
      {confirm}
    </>
  );
}

/** A two-slot Heat takes its winner; a bigger one its finishing order. */
function HeatResultSheet(props: HeatResultFormProps) {
  return props.heat.slots.length > 2 ? (
    <FinishingOrderForm {...props} />
  ) : (
    <WinnerForm {...props} />
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
};

/**
 * Runs a Bracket on a phone: Heats by Round as Cards, a tap opens the Heat
 * Result Sheet, "Time & place" opens the Heat's time Sheet; the champion
 * and Finalize / Un-finalize sit on top. Refreshes live while no Sheet is
 * open.
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

      <Sheet
        open={resultHeat !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
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
        </SheetContent>
      </Sheet>

      <Sheet
        open={scheduleHeat !== undefined}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
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
        </SheetContent>
      </Sheet>

      {openSheet === null && <AutoRefresh />}
    </div>
  );
}
