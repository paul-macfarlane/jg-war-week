"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import type { MatchResultActionResult } from "@/actions/brackets";
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
import type { Bracket, Match, MatchResult } from "@/lib/bracket/types";
import { finalRoundOf, isDecided, matchName } from "@/lib/bracket/view";

type Scoring = "team" | "individual";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export type MatchResultFormProps = {
  match: Match;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  primaryColor: string;
  /** Saves the Match result: a Host's record, or a Participant's report. */
  submit: (result: MatchResult) => Promise<MatchResultActionResult>;
  /**
   * Whether a result that resets later Matches asks first, naming them (the
   * results screen). A report is of an open Match, which has none to reset.
   */
  confirmResets: boolean;
  /** The success toast, given the 1st-place Entrant's label and the Match's name. */
  successToast: (winner: string, match: string) => string;
  onSaved: () => void;
};

/**
 * Saving a Match result from either form: the later Matches it would reset
 * (named, for the confirm), and a `save` that submits it and toasts
 * `successToast` (plus how many later Matches were reset). A refusal toasts
 * the server's message and leaves the form open with its input kept.
 */
function useSaveMatchResult(
  {
    match,
    bracket,
    entrantsById,
    submit,
    confirmResets,
    successToast,
    onSaved,
  }: MatchResultFormProps,
  result: MatchResult | null,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = matchName(bracket, match);
  const label = (entrantId: string) =>
    entrantsById.get(entrantId)?.label ?? "Unknown";
  const resetNames = (
    confirmResets && result ? resetByResult(bracket, match.id, result) : []
  ).map((resetId) =>
    matchName(
      bracket,
      bracket.matches.find((h) => h.id === resetId)!,
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
      const reset = saved.resetMatchIds.length;
      toast.success(
        successToast(label(first), name) +
          (reset > 0
            ? ` · ${plural(reset, "later Match", "later Matches")} reset`
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
        {pending ? "Saving…" : "Save Match Result"}
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
 * The Match result form for a two-slot Match: tap the Winner, optional
 * scores. With `confirmResets`, changing the Winner of a Match whose later
 * Matches have results asks first, naming them; a score-only edit doesn't
 * ask.
 */
export function WinnerForm(props: MatchResultFormProps) {
  const { match, entrantsById, scoring, primaryColor } = props;
  const id = useId();
  const ids = match.slots.map((s) => s.entrantId!);
  const decided = isDecided(match);
  const [winner, setWinner] = useState<string | null>(
    decided
      ? (match.slots.find((s) => s.place === 1)?.entrantId ?? null)
      : null,
  );
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(match.slots.map((s) => [s.entrantId!, s.score ?? ""])),
  );
  const result: MatchResult | null = winner
    ? {
        order: [winner, ...ids.filter((e) => e !== winner)],
        scores: filledScores(scores),
      }
    : null;
  const { name, label, saveButton, confirm } = useSaveMatchResult(
    props,
    result,
  );

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
 * The Match result form for a Match of more than two: tap the Entrants in
 * finishing order (each shows its place), Undo the last tap, optional
 * scores. With `confirmResets`, a result that changes who advances
 * from a complete Round asks first, naming the later Matches it resets.
 */
export function FinishingOrderForm(props: MatchResultFormProps) {
  const { match, entrantsById, scoring, primaryColor } = props;
  const id = useId();
  const ids = match.slots.map((s) => s.entrantId!);
  const decided = isDecided(match);
  const [order, setOrder] = useState<string[]>(() =>
    decided
      ? [...match.slots]
          .sort((a, b) => (a.place ?? 0) - (b.place ?? 0))
          .map((s) => s.entrantId!)
      : [],
  );
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(match.slots.map((s) => [s.entrantId!, s.score ?? ""])),
  );
  const isFinal = match.round >= finalRoundOf(props.bracket);
  const complete = order.length === ids.length;
  const result: MatchResult | null = complete
    ? {
        order,
        scores: filledScores(scores),
      }
    : null;
  const { name, label, saveButton, confirm } = useSaveMatchResult(
    props,
    result,
  );

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
              place > 0 && advancesAtPlace(props.bracket, match, place);
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

/** A two-slot Match takes its Winner; a bigger one its finishing order. */
export function MatchResultForm(props: MatchResultFormProps) {
  return props.match.slots.length > 2 ? (
    <FinishingOrderForm {...props} />
  ) : (
    <WinnerForm {...props} />
  );
}
