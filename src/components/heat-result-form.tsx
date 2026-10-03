"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import type { HeatResultActionResult } from "@/actions/brackets";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  type BracketViewEntrant,
  EntrantMark,
} from "@/components/entrant-mark";
import {
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogFooter,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { resetByResult } from "@/lib/bracket/formats";
import { advancesAtPlace } from "@/lib/bracket/tree";
import type { Bracket, Heat, HeatResult } from "@/lib/bracket/types";
import { finalRoundOf, heatName, isDecided } from "@/lib/bracket/view";

type Scoring = "team" | "individual";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export type HeatResultFormProps = {
  heat: Heat;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  /** Saves the Heat Result: a Host's record, or a Participant's report. */
  submit: (result: HeatResult) => Promise<HeatResultActionResult>;
  /**
   * Whether a result that resets later Heats asks first, naming them (the
   * results screen). A report is of an open Heat, which has none to reset.
   */
  confirmResets: boolean;
  /** The success toast, given the 1st-place Entrant's label and the Heat's name. */
  successToast: (winner: string, heat: string) => string;
  onSaved: () => void;
};

/**
 * Saving a Heat Result from either form: the later Heats it would reset
 * (named, for the confirm), and a `save` that submits it and toasts
 * `successToast` (plus how many later Heats were reset). A refusal toasts
 * the server's message and leaves the form open with its input kept.
 */
function useSaveHeatResult(
  {
    heat,
    bracket,
    entrantsById,
    submit,
    confirmResets,
    successToast,
    onSaved,
  }: HeatResultFormProps,
  result: HeatResult | null,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = heatName(bracket, heat);
  const label = (entrantId: string) =>
    entrantsById.get(entrantId)?.label ?? "Unknown";
  const resetNames = (
    confirmResets && result ? resetByResult(bracket, heat.id, result) : []
  ).map((resetId) =>
    heatName(
      bracket,
      bracket.heats.find((h) => h.id === resetId)!,
    ),
  );

  function save() {
    if (!result) return;
    const first = result.order[0]!;
    startTransition(async () => {
      const saved = await submit(result);
      setConfirmOpen(false);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      const reset = saved.resetHeatIds.length;
      toast.success(
        successToast(label(first), name) +
          (reset > 0
            ? ` · ${plural(reset, "later Heat", "later Heats")} reset`
            : ""),
      );
      onSaved();
      router.refresh();
    });
  }

  const saveButton = (
    <ResponsiveSheetDialogFooter>
      <Button
        type="button"
        size="lg"
        className="min-h-11"
        disabled={!result || pending}
        onClick={() => (resetNames.length > 0 ? setConfirmOpen(true) : save())}
      >
        {pending ? "Saving…" : "Save Heat Result"}
      </Button>
    </ResponsiveSheetDialogFooter>
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

/**
 * The Heat Result form for a two-slot Heat: tap the winner, optional
 * scores. With `confirmResets`, changing the
 * winner of a Heat whose later Heats have results asks first, naming them;
 * a score-only edit doesn't ask.
 */
export function WinnerForm(props: HeatResultFormProps) {
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
  const result: HeatResult | null = winner
    ? {
        order: [winner, ...ids.filter((e) => e !== winner)],
        scores: filledScores(scores),
      }
    : null;
  const { name, label, saveButton, confirm } = useSaveHeatResult(props, result);

  return (
    <>
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>{name}</ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          Tap the winner. Scores are optional.
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <div className="flex flex-col gap-4 px-4">
        <ToggleGroup
          aria-label="Winner"
          value={winner ? [winner] : []}
          onValueChange={(value) => {
            // A choice can't be deselected: clicking the pressed item again
            // would otherwise clear the group.
            const [next] = value as string[];
            if (!next) return;
            setWinner(next);
          }}
          variant="outline"
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {ids.map((entrantId) => {
            const entrant = entrantsById.get(entrantId)!;
            const chosen = winner === entrantId;
            return (
              <ToggleGroupItem
                key={entrantId}
                value={entrantId}
                className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80 h-auto min-h-11 justify-start gap-2 py-2"
              >
                <EntrantMark
                  entrant={entrant}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
                <span className="min-w-0 truncate">{entrant.label}</span>
                {chosen && <span className="ml-auto">✓ Winner</span>}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
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
 * scores. With `confirmResets`, a result that changes who advances
 * from a complete Round asks first, naming the later Heats it resets.
 */
export function FinishingOrderForm(props: HeatResultFormProps) {
  const { heat, entrantsById, scoring, primaryColor } = props;
  const id = useId();
  const ids = heat.slots.map((s) => s.entrantId!);
  const decided = isDecided(heat);
  const [order, setOrder] = useState<string[]>(() =>
    decided
      ? [...heat.slots]
          .sort((a, b) => (a.place ?? 0) - (b.place ?? 0))
          .map((s) => s.entrantId!)
      : [],
  );
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(heat.slots.map((s) => [s.entrantId!, s.score ?? ""])),
  );
  const isFinal = heat.round >= finalRoundOf(props.bracket);
  const complete = order.length === ids.length;
  const result: HeatResult | null = complete
    ? {
        order,
        scores: filledScores(scores),
      }
    : null;
  const { name, label, saveButton, confirm } = useSaveHeatResult(props, result);

  return (
    <>
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>{name}</ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          Tap the Entrants in finishing order, 1st first. Scores are optional.
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <div className="flex flex-col gap-4 px-4">
        <div
          role="group"
          aria-label="Finishing order"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {ids.map((entrantId) => {
            const entrant = entrantsById.get(entrantId)!;
            const place = order.indexOf(entrantId) + 1;
            const advances =
              place > 0 && advancesAtPlace(props.bracket, heat, place);
            return (
              <Button
                key={entrantId}
                data-advances={advances ? "" : undefined}
                type="button"
                variant={place > 0 ? "default" : "outline"}
                aria-pressed={place > 0}
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
                {advances && (
                  <span className="ml-auto text-xs font-semibold">
                    {isFinal && place === 1 ? "Wins" : "Advances"}
                  </span>
                )}
                {place > 0 && (
                  <span
                    aria-label={`Place ${place}`}
                    className={`bg-primary-foreground text-primary ${advances ? "" : "ml-auto"} flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums`}
                  >
                    {place}
                  </span>
                )}
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
export function HeatResultForm(props: HeatResultFormProps) {
  return props.heat.slots.length > 2 ? (
    <FinishingOrderForm {...props} />
  ) : (
    <WinnerForm {...props} />
  );
}
