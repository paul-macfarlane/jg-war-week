"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  finalizeBracket,
  recordHeatResult,
  unfinalizeBracket,
} from "@/actions/brackets";
import {
  type BracketViewEntrant,
  EntrantMark,
  HeatRows,
} from "@/components/bracket-view";
import {
  ConfirmActionButton,
  ConfirmDialog,
} from "@/components/confirm-dialog";
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
import { isBye, isDecided, resetByResult } from "@/lib/bracket/engine";
import type { Bracket, Heat } from "@/lib/bracket/types";
import { finalRoundOf, groupRounds, heatName } from "@/lib/bracket/view";

type Scoring = "team" | "individual";

/** A Heat the Organizer can record: both Entrants known, not a bye. */
function isRecordable(heat: Heat) {
  return !isBye(heat) && heat.slots.every((s) => s.entrantId !== null);
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The Heat Result form in the bottom Sheet: tap the winner, optional
 * scores, a Forfeit switch per Entrant. Changing the winner of a Heat whose
 * later Heats have results asks first, naming them; a score-only edit
 * doesn't ask.
 */
function HeatResultForm({
  competitionId,
  heat,
  bracket,
  entrantsById,
  scoring,
  primaryColor,
  onSaved,
}: {
  competitionId: string;
  heat: Heat;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  onSaved: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const finalRound = finalRoundOf(bracket);
  const name = heatName(heat, finalRound);
  const label = (entrantId: string) =>
    entrantsById.get(entrantId)?.label ?? "Unknown";
  const resetNames = resetByResult(bracket, heat.id, winner).map((resetId) => {
    const reset = bracket.heats.find((h) => h.id === resetId)!;
    return heatName(reset, finalRound);
  });

  function toggleForfeit(entrantId: string, on: boolean) {
    setForfeit(on ? entrantId : null);
    // A forfeiting Entrant loses, so the other one wins.
    if (on) setWinner(ids.find((other) => other !== entrantId) ?? null);
  }

  function save() {
    if (!winner) return;
    const order = [winner, ...ids.filter((e) => e !== winner)];
    const filled = Object.fromEntries(
      Object.entries(scores).filter(([, score]) => score.trim() !== ""),
    );
    startTransition(async () => {
      const result = await recordHeatResult(competitionId, heat.id, {
        order,
        scores: filled,
        forfeits: forfeit ? [forfeit] : [],
      });
      setConfirmOpen(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const reset = result.resetHeatIds.length;
      toast.success(
        `${label(winner)} wins ${name}` +
          (reset > 0
            ? ` · ${plural(reset, "later Heat", "later Heats")} reset`
            : ""),
      );
      onSaved();
      router.refresh();
    });
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
              <Field>
                <FieldLabel htmlFor={`${id}-score-${i}`}>
                  {label(entrantId)} score
                </FieldLabel>
                <Input
                  id={`${id}-score-${i}`}
                  maxLength={40}
                  placeholder="Optional, e.g. 21 or 1:32.4"
                  className="h-11 sm:h-9"
                  value={scores[entrantId] ?? ""}
                  onChange={(event) =>
                    setScores((s) => ({
                      ...s,
                      [entrantId]: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field orientation="horizontal" className="min-h-11 sm:min-h-9">
                <Switch
                  id={`${id}-forfeit-${i}`}
                  checked={forfeit === entrantId}
                  onCheckedChange={(on) => toggleForfeit(entrantId, on)}
                />
                <FieldLabel htmlFor={`${id}-forfeit-${i}`}>
                  {label(entrantId)} forfeits
                </FieldLabel>
              </Field>
            </div>
          ))}
        </FieldGroup>
      </div>
      <SheetFooter>
        <Button
          type="button"
          size="lg"
          className="min-h-11"
          disabled={!winner || pending}
          onClick={() =>
            resetNames.length > 0 ? setConfirmOpen(true) : save()
          }
        >
          {pending ? "Saving…" : "Save Heat Result"}
        </Button>
      </SheetFooter>
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
    </>
  );
}

/**
 * Runs a Bracket on a phone: Heats by Round as Cards, a tap opens the Heat
 * Result Sheet; the champion and Finalize / Un-finalize sit on top.
 */
export function BracketResults({
  competitionId,
  scoring,
  entrants,
  bracket,
  champion,
  finalized,
  primaryColor,
}: {
  competitionId: string;
  scoring: Scoring;
  entrants: BracketViewEntrant[];
  bracket: Bracket;
  champion: string | null;
  finalized: boolean;
  primaryColor: string;
}) {
  const [openHeatId, setOpenHeatId] = useState<string | null>(null);
  const entrantsById = new Map(entrants.map((e) => [e.id, e]));
  const finalRound = finalRoundOf(bracket);
  const openHeat = bracket.heats.find((h) => h.id === openHeatId);
  const winner = champion ? entrantsById.get(champion) : undefined;

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
              const name = heatName(heat, finalRound);
              const tappable = !finalized && isRecordable(heat);
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
                      <span className="text-foreground/60 flex justify-between gap-2 text-xs font-medium">
                        <span>{name}</span>
                        {tappable && (
                          <span className="text-primary">
                            {isDecided(heat) ? "Edit" : "Record result"}
                          </span>
                        )}
                      </span>
                      {rows}
                    </CardContent>
                    {tappable && (
                      // Covers the Card, so the whole Heat is one tap target.
                      <button
                        type="button"
                        aria-label={`${isDecided(heat) ? "Edit" : "Record"} ${name}`}
                        className="focus-visible:ring-ring/50 absolute inset-0 rounded-xl outline-none focus-visible:ring-3"
                        onClick={() => setOpenHeatId(heat.id)}
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
        open={openHeat !== undefined}
        onOpenChange={(open) => {
          if (!open) setOpenHeatId(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
          {openHeat && (
            <HeatResultForm
              key={openHeat.id}
              competitionId={competitionId}
              heat={openHeat}
              bracket={bracket}
              entrantsById={entrantsById}
              scoring={scoring}
              primaryColor={primaryColor}
              onSaved={() => setOpenHeatId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
