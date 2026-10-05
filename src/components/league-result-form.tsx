"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { recordLeagueResult } from "@/actions/league";
import {
  ResponsiveSheetDialog,
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogFooter,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { LeagueResult, ScoreDirection } from "@/lib/enums";
import { decidedResult } from "@/lib/league/view-text";
import type { FieldErrors } from "@/lib/result";
import { scoreLabel } from "@/lib/scoring";

/** The Match a result is recorded for: names and ids, never an email. */
export type LeagueResultTarget = {
  id: string;
  round: number;
  aName: string;
  bName: string;
  result: LeagueResult | null;
  scoreA: number | null;
  scoreB: number | null;
};

/** A Score as the text its field starts with: blank for none. */
const scoreText = (score: number | null) =>
  score === null ? "" : String(score);

/**
 * Records or changes a League Match's result, in a bottom Sheet (a centered
 * Dialog from `md`): the two Entrants as fixed rows with an optional Score
 * each, and the result (A won, Draw, B won). With a Score direction and
 * both Scores in, the Scores decide: the result is filled and its toggle
 * disabled (reading R2). The result toasts; a refusal toasts the server's
 * message and keeps the form open.
 */
export function LeagueResultForm({
  open,
  onOpenChange,
  competitionId,
  match,
  scoreDirection,
  scoreUnit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  match: LeagueResultTarget | null;
  scoreDirection: ScoreDirection;
  scoreUnit: string | null;
}) {
  return (
    <ResponsiveSheetDialog open={open} onOpenChange={onOpenChange}>
      {open && match ? (
        <LeagueResultFormBody
          key={match.id}
          onOpenChange={onOpenChange}
          competitionId={competitionId}
          match={match}
          scoreDirection={scoreDirection}
          scoreUnit={scoreUnit}
        />
      ) : null}
    </ResponsiveSheetDialog>
  );
}

function LeagueResultFormBody({
  onOpenChange,
  competitionId,
  match,
  scoreDirection,
  scoreUnit,
}: {
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  match: LeagueResultTarget;
  scoreDirection: ScoreDirection;
  scoreUnit: string | null;
}) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const editing = match.result !== null;
  const [scores, setScores] = useState<[string, string]>([
    scoreText(match.scoreA),
    scoreText(match.scoreB),
  ]);
  const [picked, setPicked] = useState<LeagueResult | null>(match.result);
  const decided = decidedResult(scoreDirection, scores[0], scores[1]);
  const result = decided ?? picked;
  const label = scoreLabel({ unit: scoreUnit });

  function submit() {
    startTransition(async () => {
      const saved = await recordLeagueResult(competitionId, match.id, {
        result: result ?? "",
        scoreA: scores[0],
        scoreB: scores[1],
      });
      if (!saved.ok) {
        setErrors((saved as { fieldErrors?: FieldErrors }).fieldErrors ?? {});
        toast.error(saved.error);
        return;
      }
      toast.success(editing ? "Result updated" : "Result recorded");
      onOpenChange(false);
      router.refresh();
    });
  }

  const sides = [match.aName, match.bName] as const;
  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>
          {editing ? "Edit result" : "Record result"}
        </ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          {`Round ${match.round}: ${match.aName} v ${match.bName}. `}
          {scoreDirection === "none"
            ? "Scores are optional; choose the result."
            : "Enter both Scores and the result follows them."}
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <FieldGroup className="gap-4 px-4">
        {sides.map((name, i) => (
          <Field key={i} data-invalid={Boolean(errors.scoreA || errors.scoreB)}>
            <FieldLabel htmlFor={`${id}-score-${i}`}>
              {name}: {label}
            </FieldLabel>
            <Input
              id={`${id}-score-${i}`}
              inputMode="decimal"
              className="h-11 sm:h-9"
              value={scores[i]}
              onChange={(event) =>
                setScores((current) =>
                  i === 0
                    ? [event.target.value, current[1]]
                    : [current[0], event.target.value],
                )
              }
            />
            <FieldError>{i === 0 ? errors.scoreA : errors.scoreB}</FieldError>
          </Field>
        ))}
        <Field data-invalid={Boolean(errors.result)}>
          <span id={`${id}-result`} className="text-sm font-medium">
            Result
          </span>
          <ToggleGroup
            aria-labelledby={`${id}-result`}
            value={result ? [result] : []}
            disabled={decided !== null}
            onValueChange={(value) => {
              // A choice can't be deselected: pressing the pressed item
              // again would otherwise clear the group.
              const [next] = value as LeagueResult[];
              if (next) setPicked(next);
            }}
            variant="outline"
            className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {(
              [
                ["a", `${match.aName} won`],
                ["draw", "Draw"],
                ["b", `${match.bName} won`],
              ] as [LeagueResult, string][]
            ).map(([value, text]) => (
              <ToggleGroupItem
                key={value}
                value={value}
                className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/80 h-auto min-h-11 py-2 whitespace-normal sm:min-h-9"
              >
                {text}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {decided !== null ? (
            <FieldDescription data-slot="decided-by-scores">
              The Scores decide this result.
            </FieldDescription>
          ) : null}
          <FieldError>{errors.result}</FieldError>
        </Field>
      </FieldGroup>
      <ResponsiveSheetDialogFooter>
        <Button type="submit" size="lg" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : "Save result"}
        </Button>
      </ResponsiveSheetDialogFooter>
    </form>
  );
}
