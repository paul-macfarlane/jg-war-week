"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useId,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { logResult, updateResult } from "@/actions/logged-results";
import { ParticipantPicker } from "@/components/participant-picker";
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
import { attemptsLeft } from "@/lib/best-score/log-rule";
import type { LoggedFormat } from "@/lib/enums";
import { resultNoun } from "@/lib/logged-results";
import { buildParticipantOptions } from "@/lib/participant-options";
import type { FieldErrors } from "@/lib/result";
import { type ScoringConfig, parseScore, scoreLabel } from "@/lib/scoring";
import type { SeriesConfig } from "@/lib/series/config";
import { computedOutcome } from "@/lib/series/input";
import type {
  LoggedConfig,
  LoggedResultsName,
  LoggedResultsPlayer,
  LoggedResultsPlayerOption,
} from "@/queries/logged-results";

type Scoring = "team" | "individual";
type Linked = { participantId: string; teamId: string | null } | null;

/** A Match or Attempt being edited: its id and its players with places and scores. */
export type ResultFormValue = { id: string; players: LoggedResultsPlayer[] };

export type ResultFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  format: LoggedFormat;
  config: LoggedConfig;
  /** The Score direction and unit. */
  scoringConfig: ScoringConfig;
  scoring: Scoring;
  /**
   * A Head-to-head's two Entrants (its fixed rows), or Best score's
   * Participants (a Host's picker): names and ids only.
   */
  playerOptions: LoggedResultsPlayerOption[];
  /** The viewer's linked Participant: who a Participant logs as. */
  linked: Linked;
  /** The viewer runs the Competition: logs for anyone. */
  runs: boolean;
  /** Best score's "Max attempts per person"; null for none. */
  maxAttempts?: number | null;
  /** Best score: each Participant's Attempts so far, by id. */
  attemptCounts?: Record<string, number>;
  /** The Match or Attempt to edit, or null to log a new one. */
  result: ResultFormValue | null;
};

/**
 * Logging or editing a Match or Attempt, in a bottom Sheet (a centered
 * Dialog on large screens), per Format: Head-to-head shows its two
 * Entrants as fixed rows with a Score each, and the Winner the Scores give
 * (or picked); Best score a Score, logged as yourself or, for a Host, for
 * a Participant picked, with Attempts left. The result toasts; a refusal
 * toasts the server's message and keeps the form open with its input.
 */
export function ResultForm(props: ResultFormProps) {
  const { open, onOpenChange, result } = props;
  return (
    <ResponsiveSheetDialog open={open} onOpenChange={onOpenChange}>
      {open ? <ResultFormBody key={result?.id ?? "new"} {...props} /> : null}
    </ResponsiveSheetDialog>
  );
}

function fieldErrorsFrom(result: { ok: boolean }): FieldErrors {
  return (result as { fieldErrors?: FieldErrors }).fieldErrors ?? {};
}

/** A Score as the text its field starts with: blank for none. */
const scoreText = (score: number | null | undefined) =>
  score === null || score === undefined ? "" : String(score);

function ResultFormBody(props: ResultFormProps) {
  return props.format === "head-to-head" ? (
    <MatchForm {...props} />
  ) : (
    <AttemptForm {...props} />
  );
}

/**
 * Saving the form: logs, or updates the one being edited; toasts the
 * result, or the server's refusal with its field errors kept.
 */
function useResultSubmit(
  { onOpenChange, competitionId, format, result: editing }: ResultFormProps,
  /** Saving edits the one Attempt allowed ("Update your score"). */
  updates = false,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const noun = resultNoun(format);
  function submit(raw: Record<string, unknown>) {
    startTransition(async () => {
      const result = editing
        ? await updateResult(competitionId, editing.id, raw)
        : await logResult(competitionId, raw);
      if (!result.ok) {
        setErrors(fieldErrorsFrom(result));
        toast.error(result.error);
        return;
      }
      toast.success(
        editing || updates ? `${noun.one} updated` : `${noun.one} logged`,
      );
      onOpenChange(false);
      router.refresh();
    });
  }
  return { pending, errors, submit, noun };
}

/** The Sheet's form: title, description, the fields, and its one button. */
function FormShell({
  title,
  description,
  submitLabel,
  pending,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>{title}</ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          {description}
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <FieldGroup className="gap-4 px-4">{children}</FieldGroup>
      <ResponsiveSheetDialogFooter>
        <Button type="submit" size="lg" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </ResponsiveSheetDialogFooter>
    </form>
  );
}

type Outcome = "a" | "b" | "draw";

/**
 * A Head-to-head Match: the two Entrants as fixed rows, each with a Score,
 * and the Winner. With a direction and both Scores in, the better Score
 * wins (equal Scores a Draw when draws are allowed, else a pick); a tap
 * sets it by hand, shown as "Set by hand".
 */
function MatchForm(props: ResultFormProps) {
  const { config, scoringConfig, playerOptions, result: editing } = props;
  const { pending, errors, submit, noun } = useResultSubmit(props);
  const id = useId();
  const [a, b] = playerOptions;
  const players = editing?.players ?? [];
  const playerOf = (side: LoggedResultsName | undefined) =>
    players.find((p) => p.id === side?.id);
  const [scores, setScores] = useState<[string, string]>([
    scoreText(playerOf(a)?.score),
    scoreText(playerOf(b)?.score),
  ]);
  const { drawsAllowed } = config as SeriesConfig;
  const outcomeOf = (s: [string, string]): Outcome | "tie" | null => {
    const computed = computedOutcome(
      scoringConfig.direction,
      config as SeriesConfig,
      [parseScore(s[0]), parseScore(s[1])],
    );
    return computed === 0 ? "a" : computed === 1 ? "b" : computed;
  };
  const [picked, setPicked] = useState<Outcome | null>(() => {
    const [pa, pb] = [playerOf(a), playerOf(b)];
    if (!pa || !pb) return null;
    const stored: Outcome =
      pa.place === pb.place ? "draw" : pa.place === 1 ? "a" : "b";
    return outcomeOf(scores) === stored ? null : stored;
  });
  const computed = outcomeOf(scores);
  const fromScores = computed === "tie" ? null : computed;
  const outcome = picked ?? fromScores;
  const byHand = picked !== null && computed !== null && picked !== computed;

  const winnerId =
    picked === null
      ? ""
      : picked === "draw"
        ? "draw"
        : picked === "a"
          ? (a?.id ?? "")
          : (b?.id ?? "");

  const label = scoreLabel(scoringConfig);
  return (
    <FormShell
      title={editing ? `Edit ${noun.one}` : `Log ${noun.a}`}
      description="Enter both Scores; the Winner follows them. Tap a Winner to set it by hand."
      submitLabel={editing ? `Save ${noun.one}` : `Log ${noun.one}`}
      pending={pending}
      onSubmit={() =>
        submit({
          sides: [
            { id: a?.id ?? "", score: scores[0] },
            { id: b?.id ?? "", score: scores[1] },
          ],
          winner: winnerId,
        })
      }
    >
      {[a, b].map((side, i) =>
        side ? (
          <Field key={side.id} data-invalid={Boolean(errors.sides)}>
            <FieldLabel htmlFor={`${id}-score-${i}`}>
              {side.name}: {label}
            </FieldLabel>
            <Input
              id={`${id}-score-${i}`}
              inputMode="decimal"
              className="h-11 sm:h-9"
              value={scores[i]}
              onChange={(e) =>
                setScores((s) =>
                  i === 0 ? [e.target.value, s[1]] : [s[0], e.target.value],
                )
              }
            />
          </Field>
        ) : null,
      )}
      <Field data-invalid={Boolean(errors.winner)}>
        <span id={`${id}-outcome`} className="text-sm font-medium">
          Winner
        </span>
        <ToggleGroup
          aria-labelledby={`${id}-outcome`}
          value={outcome ? [outcome] : []}
          onValueChange={(value) => {
            // A choice can't be deselected: clicking the pressed item
            // again would otherwise clear the group.
            const [next] = value as Outcome[];
            if (next) setPicked(next === fromScores ? null : next);
          }}
          variant="outline"
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {(
            [
              ["a", `${a?.name ?? "First"} won`],
              ["b", `${b?.name ?? "Second"} won`],
              ...(drawsAllowed ? [["draw", "Draw"]] : []),
            ] as [Outcome, string][]
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
        {byHand ? (
          <FieldDescription data-slot="set-by-hand">
            Set by hand
          </FieldDescription>
        ) : computed === "tie" && picked === null ? (
          <FieldDescription>
            The Scores are equal: pick the Winner.
          </FieldDescription>
        ) : null}
        <FieldError>{errors.winner}</FieldError>
      </Field>
    </FormShell>
  );
}

/**
 * A Best score Attempt: its Score. A Participant logs as themselves (no
 * picker); a Host or Organizer picks the Participant. With "Max attempts
 * per person", the form says how many are left, and at a limit of 1 with
 * the Attempt in, it updates that score instead.
 */
function AttemptForm(props: ResultFormProps) {
  const {
    scoringConfig,
    playerOptions,
    linked,
    runs,
    maxAttempts = null,
    attemptCounts = {},
    result: editing,
  } = props;
  const id = useId();
  const options = buildParticipantOptions(
    playerOptions.map((o) => ({
      id: o.id,
      name: o.name,
      image: o.image,
      teamName: o.teamName,
      teamColor: o.color,
    })),
  );
  const fixed =
    editing?.players[0]?.id ?? (runs ? null : linked?.participantId);
  const [player, setPlayer] = useState(fixed ?? "");
  const [score, setScore] = useState(scoreText(editing?.players[0]?.score));
  const nameOf = (pid: string) =>
    playerOptions.find((o) => o.id === pid)?.name ?? null;
  const count = player ? (attemptCounts[player] ?? 0) : 0;
  const left = editing || !player ? null : attemptsLeft(maxAttempts, count);
  const updates = !editing && maxAttempts === 1 && count >= 1;
  const { pending, errors, submit, noun } = useResultSubmit(props, updates);

  const name = nameOf(player);
  const title = editing
    ? `Edit ${noun.one}`
    : updates
      ? runs
        ? name
          ? `Update ${name}'s score`
          : "Update their score"
        : "Update your score"
      : `Log ${noun.a}`;

  return (
    <FormShell
      title={title}
      description={
        runs && !editing
          ? "Choose the Participant and enter their Score."
          : "Enter the Score."
      }
      submitLabel={editing || updates ? `Save ${noun.one}` : `Log ${noun.one}`}
      pending={pending}
      onSubmit={() => submit({ player, score })}
    >
      {fixed === null || fixed === undefined ? (
        <Field data-invalid={Boolean(errors.player)}>
          <FieldLabel htmlFor={`${id}-player`}>Participant</FieldLabel>
          <ParticipantPicker
            id={`${id}-player`}
            options={options}
            value={player}
            onValueChange={setPlayer}
            placeholder="Choose a Participant"
            aria-invalid={Boolean(errors.player)}
          />
          <FieldError>{errors.player}</FieldError>
        </Field>
      ) : runs || editing ? (
        <p className="text-sm">
          <span className="text-foreground/70">Participant: </span>
          <span className="font-medium">{nameOf(fixed) ?? "Unknown"}</span>
        </p>
      ) : null}
      <Field data-invalid={Boolean(errors.score)}>
        <FieldLabel htmlFor={`${id}-score`}>
          {scoreLabel(scoringConfig)}
        </FieldLabel>
        <Input
          id={`${id}-score`}
          inputMode="decimal"
          className="h-11 sm:h-9"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          aria-invalid={Boolean(errors.score)}
        />
        {updates ? (
          <FieldDescription data-slot="attempts-left">
            Saving replaces the one Attempt allowed.
          </FieldDescription>
        ) : left !== null ? (
          <FieldDescription data-slot="attempts-left">
            {left === 1 ? "1 attempt left" : `${left} attempts left`}
          </FieldDescription>
        ) : null}
        <FieldError>{errors.score}</FieldError>
      </Field>
    </FormShell>
  );
}
