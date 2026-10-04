"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  moveMatchEntrant,
  setMatchAdvance,
  setRoundDefaults,
} from "@/actions/brackets";
import type { BracketViewEntrant } from "@/components/entrant-mark";
import { OptionSelect } from "@/components/option-select";
import {
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  ADVANCE_PER_MATCH_OPTIONS,
  GROUP_ENTRANTS_PER_MATCH_OPTIONS,
  advancePerMatchLabel,
  entrantsPerMatchLabel,
} from "@/lib/bracket/config";
import { finalRoundOf } from "@/lib/bracket/final";
import {
  matchAdvanceCount,
  roundDefaultsOf,
  roundLockReason,
} from "@/lib/bracket/groups";
import type { Bracket, Match } from "@/lib/bracket/types";
import { matchName, roundName } from "@/lib/bracket/view";
import type { WriteResult } from "@/lib/result";

/** Runs one tree edit: a refusal toasts its reason; a save refreshes. */
function useTreeEdit() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (write: () => Promise<WriteResult>, success: string) =>
    startTransition(async () => {
      const saved = await write();
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

/** One Match of the Round: how many advance, and each Entrant's move. */
function MatchEdits({
  competitionId,
  bracket,
  match,
  others,
  entrantsById,
  disabled,
  run,
}: {
  competitionId: string;
  bracket: Bracket;
  match: Match;
  others: Match[];
  entrantsById: Map<string, BracketViewEntrant>;
  disabled: boolean;
  run: ReturnType<typeof useTreeEdit>["run"];
}) {
  const id = useId();
  const name = matchName(bracket, match);
  const size = match.slots.length;
  const advancing = matchAdvanceCount(bracket, match);
  const filled = match.slots.every((s) => s.entrantId !== null);
  return (
    <section
      aria-label={name}
      className="ring-foreground/10 flex flex-col gap-3 rounded-lg p-3 ring-1"
    >
      <h3 className="text-sm font-semibold">
        {name}
        <span className="text-foreground/70 font-normal">
          {" "}
          · {size === 1 ? "1 Entrant" : `${size} Entrants`}
          {size <= advancing ? " · Bye" : ""}
        </span>
      </h3>
      <Field className="sm:max-w-56">
        <FieldLabel htmlFor={`${id}-advance`}>How many advance</FieldLabel>
        <OptionSelect
          id={`${id}-advance`}
          aria-label={`How many advance from ${name}`}
          options={Array.from({ length: size }, (_, i) => i + 1).map(
            (count) => ({
              value: String(count),
              label: advancePerMatchLabel(count),
            }),
          )}
          value={String(advancing)}
          disabled={disabled}
          onValueChange={(value) =>
            run(
              () =>
                setMatchAdvance(competitionId, match.id, {
                  advanceCount: Number(value),
                }),
              `${name}: ${advancePerMatchLabel(Number(value))}`,
            )
          }
        />
      </Field>
      {filled && others.length > 0 && (
        <ul className="flex flex-col gap-2">
          {match.slots.map((slot) => {
            const label = entrantsById.get(slot.entrantId!)?.label ?? "Unknown";
            return (
              <li
                key={slot.entrantId}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate text-sm">{label}</span>
                <span className="w-full sm:w-52">
                  <OptionSelect
                    aria-label={`Move ${label} to`}
                    options={[
                      { value: "", label: "Move to…", disabled: true },
                      ...others.map((other) => ({
                        value: other.id,
                        label: matchName(bracket, other),
                        disabled: other.slots.length >= 8,
                      })),
                    ]}
                    value=""
                    disabled={disabled}
                    onValueChange={(toMatchId) => {
                      if (!toMatchId) return;
                      const to = others.find((o) => o.id === toMatchId)!;
                      run(
                        () =>
                          moveMatchEntrant(competitionId, {
                            entrantId: slot.entrantId!,
                            toMatchId,
                          }),
                        `${label} moved to ${matchName(bracket, to)}`,
                      );
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Edits one Round of a Group Bracket (spec R21, decision 11), for an
 * Organizer or a Host: the Round's defaults (entrants per Match, how many
 * advance; a filled Round is dealt again), each Match's advancing count,
 * and moving an Entrant to another Match of the Round. Every later Round
 * follows. Once any Match in the Round has a result, it's locked: the
 * reason shows as text and every control is disabled (the server refuses
 * too).
 */
export function BracketRoundEditor({
  competitionId,
  bracket,
  round,
  entrantsById,
}: {
  competitionId: string;
  bracket: Bracket;
  round: number;
  entrantsById: Map<string, BracketViewEntrant>;
}) {
  const id = useId();
  const { pending, run } = useTreeEdit();
  const name = roundName(bracket, round);
  const locked = roundLockReason(bracket, round);
  const disabled = locked !== null || pending;
  const final = round >= finalRoundOf(bracket);
  const matches = bracket.matches
    .filter((m) => m.round === round)
    .sort((a, b) => a.position - b.position);
  const defaults = roundDefaultsOf(bracket.config, round);
  const [perMatch, setPerMatch] = useState(defaults.entrantsPerMatch);
  const [advance, setAdvance] = useState(defaults.advancePerMatch);
  const unchanged =
    perMatch === defaults.entrantsPerMatch &&
    advance === defaults.advancePerMatch;

  return (
    <>
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>Edit {name}</ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          Every later Round follows your changes.
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <div className="flex flex-col gap-5 px-4 pb-4">
        {locked && (
          <p data-slot="lock-reason" className="text-foreground/70 text-sm">
            {locked}
          </p>
        )}
        <FieldSet>
          <FieldLegend variant="label">Round defaults</FieldLegend>
          <FieldDescription>
            How {name}&apos;s Matches are dealt; saving deals it again.
          </FieldDescription>
          <FieldGroup className="gap-4 sm:flex-row">
            <Field className="sm:max-w-48">
              <FieldLabel htmlFor={`${id}-entrants`}>
                Entrants per Match
              </FieldLabel>
              <OptionSelect
                id={`${id}-entrants`}
                options={GROUP_ENTRANTS_PER_MATCH_OPTIONS.map((count) => ({
                  value: String(count),
                  label: entrantsPerMatchLabel(count),
                }))}
                value={String(perMatch)}
                disabled={disabled}
                onValueChange={(value) => {
                  const size = Number(value);
                  setPerMatch(size);
                  setAdvance((a) => Math.min(a, size - 1));
                }}
              />
            </Field>
            <Field className="sm:max-w-48">
              <FieldLabel htmlFor={`${id}-advance`}>
                How many advance
              </FieldLabel>
              <OptionSelect
                id={`${id}-advance`}
                options={ADVANCE_PER_MATCH_OPTIONS.filter(
                  (count) => count < perMatch,
                ).map((count) => ({
                  value: String(count),
                  label: advancePerMatchLabel(count),
                }))}
                value={String(advance)}
                disabled={disabled}
                onValueChange={(value) => setAdvance(Number(value))}
              />
            </Field>
          </FieldGroup>
          <Button
            type="button"
            className="min-h-11 self-start sm:min-h-9"
            disabled={disabled || unchanged}
            onClick={() =>
              run(
                () =>
                  setRoundDefaults(competitionId, {
                    round,
                    entrantsPerMatch: perMatch,
                    advancePerMatch: advance,
                  }),
                `${name} defaults saved`,
              )
            }
          >
            Save Round defaults
          </Button>
        </FieldSet>
        {!final &&
          matches.map((match) => (
            <MatchEdits
              key={match.id}
              competitionId={competitionId}
              bracket={bracket}
              match={match}
              others={matches.filter((m) => m.id !== match.id)}
              entrantsById={entrantsById}
              disabled={disabled}
              run={run}
            />
          ))}
      </div>
    </>
  );
}
