"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  type BracketViewEntrant,
  EntrantMark,
  EntrantTeam,
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
import { advancesAtPlace } from "@/lib/bracket/tree";
import type { Bracket, Match, MatchResult } from "@/lib/bracket/types";
import { finalRoundOf, isDecided, matchName } from "@/lib/bracket/view";
import type { ScoreDirection } from "@/lib/enums";
import { finishingOrder, parseScore } from "@/lib/scoring";
import type { MutationResult } from "@/mutations/types";

type Scoring = "team" | "individual";

export type MatchResultFormProps = {
  match: Match;
  bracket: Bracket;
  entrantsById: Map<string, BracketViewEntrant>;
  scoring: Scoring;
  /** The Competition's Score unit, shown in each Score input's label. */
  scoreUnit?: string | null;
  /** With a direction, the Scores decide the places (spec R21, decision 7). */
  scoreDirection?: ScoreDirection;
  primaryColor: string;
  /** Saves the Match result: a Host's record, or a Participant's report. */
  submit: (result: MatchResult) => Promise<MutationResult>;
  /** Clears a recorded result; offered once the Match is decided. */
  clear?: () => Promise<MutationResult>;
  /** The success toast, given the 1st-place Entrant's label and the Match's name. */
  successToast: (winner: string, match: string) => string;
  onSaved: () => void;
};

/** The scores typed so far, without the empty ones. */
function filledScores(scores: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(scores).filter(([, score]) => score.trim() !== ""),
  );
}

/** The order the Scores give (`finishingOrder`), by the slot order. */
function scoredOrder(
  ids: string[],
  scores: Record<string, string>,
  direction: ScoreDirection,
) {
  return finishingOrder(
    ids.map((id) => ({ id, score: parseScore(scores[id] ?? "") })),
    direction,
  );
}

const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Saving a Match result from either form: a `save` that submits it and
 * toasts `successToast`, and, for a decided Match, Clear result behind a
 * confirm. A refusal toasts the server's message and leaves the form open
 * with its input kept.
 */
function useSaveMatchResult(
  {
    match,
    bracket,
    entrantsById,
    submit,
    clear,
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

  function run(write: () => Promise<MutationResult>, success: string) {
    startTransition(async () => {
      const saved = await write();
      setConfirmOpen(false);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success(success);
      onSaved();
      router.refresh();
    });
  }

  const canClear = clear !== undefined && isDecided(match);
  const footer = (
    <ResponsiveSheetDialogFooter>
      {canClear && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          Clear result
        </Button>
      )}
      <Button
        type="button"
        size="lg"
        className="min-h-11"
        disabled={!result || pending}
        onClick={() => {
          if (result) {
            run(
              () => submit(result),
              successToast(label(result.order[0]!), name),
            );
          }
        }}
      >
        {pending ? "Saving…" : "Save Match Result"}
      </Button>
    </ResponsiveSheetDialogFooter>
  );
  const confirm = canClear ? (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={`Clear the ${name} result?`}
      description="Its places and Scores go, and whoever it sent on leaves the next Match."
      confirmLabel="Clear result"
      pending={pending}
      onConfirm={() => run(clear, `${name} result cleared`)}
    />
  ) : null;
  return { name, label, footer, confirm };
}

/** A score input for one Entrant. */
function ScoreField({
  id,
  label,
  unit,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id} className="min-w-0 break-words">
        {label} score{unit ? ` (${unit})` : ""}
      </FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        maxLength={14}
        placeholder="Optional, e.g. 21 or 9.5"
        className="h-11 sm:h-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** "Set by hand", or how to settle equal Scores. */
function ScoreNote({ byHand, tied }: { byHand: boolean; tied: boolean }) {
  if (byHand) {
    return (
      <p data-slot="set-by-hand" className="text-foreground/70 text-sm">
        Set by hand
      </p>
    );
  }
  return tied ? (
    <p className="text-foreground/70 text-sm">
      Equal Scores: settle the order by hand.
    </p>
  ) : null;
}

function ScoreFields({
  formId,
  ids,
  label,
  unit,
  scores,
  setScores,
}: {
  formId: string;
  ids: string[];
  label: (id: string) => string;
  unit: string | null;
  scores: Record<string, string>;
  setScores: (
    update: (s: Record<string, string>) => Record<string, string>,
  ) => void;
}) {
  return (
    <FieldGroup className="gap-4">
      {ids.map((entrantId, i) => (
        <div key={entrantId} className="flex flex-col gap-2">
          <ScoreField
            id={`${formId}-score-${i}`}
            label={label(entrantId)}
            unit={unit}
            value={scores[entrantId] ?? ""}
            onChange={(value) =>
              setScores((s) => ({ ...s, [entrantId]: value }))
            }
          />
        </div>
      ))}
    </FieldGroup>
  );
}

/**
 * The Match result form for a two-slot Match: Scores, and the Winner. With
 * a Score direction and both Scores in, the better Score wins; equal
 * Scores need a tap. Tapping the other Entrant overrides the Scores and
 * shows "Set by hand".
 */
export function WinnerForm(props: MatchResultFormProps) {
  const {
    match,
    entrantsById,
    scoring,
    scoreUnit,
    scoreDirection = "none",
    primaryColor,
  } = props;
  const id = useId();
  const ids = match.slots.map((s) => s.entrantId!);
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(match.slots.map((s) => [s.entrantId!, s.score ?? ""])),
  );
  const computed = scoredOrder(ids, scores, scoreDirection);
  const scoreWinner =
    computed && !computed.tied ? (computed.order[0] ?? null) : null;
  const [picked, setPicked] = useState<string | null>(() => {
    if (!isDecided(match)) return null;
    const stored = match.slots.find((s) => s.place === 1)?.entrantId ?? null;
    const initial = scoredOrder(ids, scores, scoreDirection);
    return initial && !initial.tied && initial.order[0] === stored
      ? null
      : stored;
  });
  const winner = picked ?? scoreWinner;
  const byHand = picked !== null && computed !== null && picked !== scoreWinner;
  const result: MatchResult | null = winner
    ? {
        order: [winner, ...ids.filter((e) => e !== winner)],
        scores: filledScores(scores),
      }
    : null;
  const { name, label, footer, confirm } = useSaveMatchResult(props, result);

  return (
    <>
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>{name}</ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          {scoreDirection === "none"
            ? "Tap the winner. Scores are optional."
            : "Enter both Scores: the better one wins. Tap a winner to set it by hand."}
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <div className="flex flex-col gap-4 px-4">
        <ScoreFields
          formId={id}
          ids={ids}
          label={label}
          unit={scoreUnit?.trim() || null}
          scores={scores}
          setScores={setScores}
        />
        <ToggleGroup
          aria-label="Winner"
          value={winner ? [winner] : []}
          onValueChange={(value) => {
            // A choice can't be deselected: clicking the pressed item again
            // would otherwise clear the group.
            const [next] = value as string[];
            if (!next) return;
            setPicked(next === scoreWinner ? null : next);
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
                <EntrantTeam entrant={entrant} scoring={scoring} responsive />
                {chosen && <span className="ml-auto">✓ Winner</span>}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <ScoreNote byHand={byHand} tied={computed?.tied === true && !picked} />
      </div>
      {footer}
      {confirm}
    </>
  );
}

/**
 * The Match result form for a Match of more than two: Scores, and the
 * finishing order. With a Score direction and every Score in, the order
 * (and so who advances) follows the Scores; tapping the Entrants in order
 * sets it by hand instead (equal Scores need that), and Use Scores goes
 * back.
 */
export function FinishingOrderForm(props: MatchResultFormProps) {
  const {
    match,
    entrantsById,
    scoring,
    scoreUnit,
    scoreDirection = "none",
    primaryColor,
  } = props;
  const id = useId();
  const ids = match.slots.map((s) => s.entrantId!);
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(match.slots.map((s) => [s.entrantId!, s.score ?? ""])),
  );
  const computed = scoredOrder(ids, scores, scoreDirection);
  const [manual, setManual] = useState<string[] | null>(() => {
    if (!isDecided(match)) return null;
    const stored = [...match.slots]
      .sort((a, b) => (a.place ?? 0) - (b.place ?? 0))
      .map((s) => s.entrantId!);
    const initial = scoredOrder(ids, scores, scoreDirection);
    return initial && !initial.tied && sameOrder(initial.order, stored)
      ? null
      : stored;
  });
  const fromScores = computed && !computed.tied ? computed.order : null;
  const order = manual ?? fromScores ?? [];
  const isFinal = match.round >= finalRoundOf(props.bracket);
  const complete = order.length === ids.length;
  const byHand =
    manual !== null &&
    complete &&
    computed !== null &&
    (computed.tied || !sameOrder(manual, computed.order));
  const result: MatchResult | null = complete
    ? { order, scores: filledScores(scores) }
    : null;
  const { name, label, footer, confirm } = useSaveMatchResult(props, result);

  return (
    <>
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>{name}</ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          {scoreDirection === "none"
            ? "Tap the Entrants in finishing order, 1st first. Scores are optional."
            : "Enter every Score: the order follows them. Tap the Entrants in order to set it by hand."}
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <div className="flex flex-col gap-4 px-4">
        <ScoreFields
          formId={id}
          ids={ids}
          label={label}
          unit={scoreUnit?.trim() || null}
          scores={scores}
          setScores={setScores}
        />
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
                  // A tap starts (or continues) an order set by hand.
                  const current = manual ?? [];
                  if (!current.includes(entrantId)) {
                    setManual([...current, entrantId]);
                  }
                }}
              >
                <EntrantMark
                  entrant={entrant}
                  scoring={scoring}
                  primaryColor={primaryColor}
                />
                <span className="min-w-0 truncate">{entrant.label}</span>
                <EntrantTeam entrant={entrant} scoring={scoring} responsive />
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 w-fit"
            disabled={manual === null || manual.length === 0}
            onClick={() => setManual((o) => (o ? o.slice(0, -1) : o))}
          >
            Undo
          </Button>
          {computed !== null && manual !== null && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11 w-fit"
              onClick={() => setManual(null)}
            >
              Use Scores
            </Button>
          )}
        </div>
        <ScoreNote
          byHand={byHand}
          tied={computed?.tied === true && !complete}
        />
      </div>
      {footer}
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
