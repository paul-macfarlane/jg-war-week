"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type BracketActionResult,
  generateBracket,
  replaceEntrants,
  setCompetitionFormat,
} from "@/actions/brackets";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntityCombobox } from "@/components/entity-combobox";
import { OptionSelect } from "@/components/option-select";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { isBye } from "@/lib/bracket/engine";
import { type Bracket, HAS_RESULTS_ERROR } from "@/lib/bracket/types";
import { type Format, formatLabel, groupRounds } from "@/lib/bracket/view";
import type { BracketEntrant } from "@/queries/brackets";

type Target = { id: string; name: string; team: string | null };

const FORMAT_OPTIONS = (["points", "single-elimination"] as const).map(
  (format) => ({ value: format, label: formatLabel(format) }),
);

/** A write that may be refused for clearing Heat Results; retried with `force`. */
type ForceableAction = {
  run: (force: boolean) => Promise<BracketActionResult>;
  success: string;
  title: string;
};

/** Same Entrants, in any order (Generate reorders them by Seed Position). */
function sameSet(a: string[], b: string[]) {
  const set = new Set(b);
  return a.length === b.length && a.every((id) => set.has(id));
}

/**
 * The Bracket builder: the Format, the Entrants ("All Teams" or picked
 * Teams for team scoring, picked Participants for individual), their
 * Seed Positions with Generate / Re-roll, and a preview of Round 1.
 */
export function BracketBuilder({
  competition,
  entrants,
  bracket,
  teams,
  participants,
  teamLabel,
}: {
  competition: {
    id: string;
    name: string;
    scoring: "team" | "individual";
    format: Format;
    finalized: boolean;
  };
  /** The saved Entrants, by Seed Position. */
  entrants: BracketEntrant[];
  bracket: Bracket;
  teams: Target[];
  participants: Target[];
  teamLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const saved = entrants.map((e) => (e.teamId ?? e.participantId)!);
  const [selected, setSelected] = useState<string[]>(saved);
  const [confirm, setConfirm] = useState<ForceableAction | null>(null);
  const isTeam = competition.scoring === "team";
  const dirty = !sameSet(selected, saved);
  const locked = competition.finalized;
  const generated = bracket.heats.length > 0;

  function runAction(action: ForceableAction, force = false) {
    startTransition(async () => {
      const result = await action.run(force);
      if (result.ok) {
        toast.success(action.success);
        setConfirm(null);
        router.refresh();
        return;
      }
      if (!force && result.error === HAS_RESULTS_ERROR) {
        setConfirm(action);
        return;
      }
      setConfirm(null);
      toast.error(result.error);
    });
  }

  function changeFormat(format: string) {
    startTransition(async () => {
      const result = await setCompetitionFormat(competition.id, { format });
      if (result.ok) {
        toast.success(`Format set to ${formatLabel(format as Format)}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const items = (isTeam ? teams : participants).map((t) => ({
    id: t.id,
    label: t.name,
    detail: t.team ?? undefined,
  }));
  const firstRound = groupRounds(bracket)[0];
  const labelOf = (entrantId: string | null) =>
    entrants.find((e) => e.id === entrantId)?.label ?? "Unknown";

  return (
    <div className="flex flex-col gap-8">
      {locked && (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          This Bracket is finalized. Un-finalize it on the results page to
          change it.
        </p>
      )}

      <Field className="max-w-xs">
        <FieldLabel htmlFor="bracket-format">Format</FieldLabel>
        <OptionSelect
          id="bracket-format"
          name="format"
          options={FORMAT_OPTIONS}
          value={competition.format}
          disabled={pending || locked}
          onValueChange={changeFormat}
        />
        <FieldDescription>
          Points is Points Entries only. A Format can&apos;t change while the
          Competition has Entrants.
        </FieldDescription>
      </Field>

      {competition.format !== "points" && (
        <>
          <FieldSet>
            <FieldLegend>Entrants</FieldLegend>
            <FieldDescription>
              {isTeam
                ? `A ${teamLabel} Competition, so its Entrants are ${teamLabel}s.`
                : "An individual Competition, so its Entrants are Participants."}{" "}
              Saving new Entrants clears the Bracket.
            </FieldDescription>
            <FieldGroup className="gap-3">
              {isTeam && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="min-h-11 w-fit"
                  disabled={pending || locked}
                  onClick={() => setSelected(teams.map((t) => t.id))}
                >
                  All {teamLabel}s
                </Button>
              )}
              <Field>
                <FieldLabel htmlFor="bracket-entrants">
                  {isTeam ? `${teamLabel}s` : "Pick Participants"} (
                  {selected.length} chosen)
                </FieldLabel>
                <EntityCombobox
                  id="bracket-entrants"
                  multiple
                  items={items}
                  value={selected}
                  onValueChange={setSelected}
                  disabled={pending || locked}
                  placeholder={
                    isTeam
                      ? `Find a ${teamLabel}`
                      : `Find by name or ${teamLabel}`
                  }
                />
              </Field>
              <Button
                type="button"
                size="lg"
                className="min-h-11 w-fit"
                disabled={pending || locked || !dirty}
                onClick={() =>
                  runAction({
                    run: (force) =>
                      replaceEntrants(competition.id, {
                        targetIds: selected,
                        force,
                      }),
                    success: "Entrants saved",
                    title: "Clear every Heat Result and save the Entrants?",
                  })
                }
              >
                Save Entrants
              </Button>
            </FieldGroup>
          </FieldSet>

          <section className="flex flex-col gap-3" aria-label="Seed Positions">
            <h2 className="text-lg font-semibold">Seed Positions</h2>
            <p className="text-foreground/70 text-sm">
              Random. Re-roll for a new draw; top Seed Positions get any byes.
            </p>
            {entrants.length === 0 ? (
              <p className="text-foreground/70 text-sm">
                No Entrants saved yet.
              </p>
            ) : (
              <ol className="flex flex-col gap-1">
                {entrants.map((e) => (
                  <li
                    key={e.id}
                    className="flex min-h-8 min-w-0 items-center gap-2 text-sm"
                  >
                    <span className="text-foreground/60 w-6 text-right tabular-nums">
                      {e.seedPosition}
                    </span>
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: e.color ?? "transparent" }}
                    />
                    <span className="truncate">{e.label}</span>
                  </li>
                ))}
              </ol>
            )}
            {dirty && (
              <p className="text-foreground/70 text-sm">
                Save the Entrants before generating.
              </p>
            )}
            <Button
              type="button"
              size="lg"
              variant={generated ? "outline" : "default"}
              className="min-h-11 w-fit"
              disabled={pending || locked || dirty || entrants.length < 2}
              onClick={() =>
                runAction({
                  run: (force) => generateBracket(competition.id, { force }),
                  success: generated
                    ? "Bracket re-rolled"
                    : "Bracket generated",
                  title: "Clear every Heat Result and draw again?",
                })
              }
            >
              {generated ? "Re-roll" : "Generate"}
            </Button>
          </section>

          {firstRound && (
            <section className="flex flex-col gap-3" aria-label="Preview">
              <h2 className="text-lg font-semibold">
                Preview · {firstRound.name}
              </h2>
              <ul className="flex flex-col gap-1 text-sm">
                {firstRound.heats.map((heat) => {
                  const [a, b] = heat.slots.map((s) => s.entrantId);
                  return (
                    <li key={heat.id} className="min-w-0 truncate">
                      {isBye(heat)
                        ? `${labelOf(a ?? b)} · Bye`
                        : `${labelOf(a)} vs ${labelOf(b)}`}
                    </li>
                  );
                })}
              </ul>
              <Link
                href={`/admin/brackets/${competition.id}`}
                className={buttonVariants({
                  size: "lg",
                  className: "min-h-11 w-fit",
                })}
              >
                Run results
              </Link>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.title ?? ""}
        description={HAS_RESULTS_ERROR}
        confirmLabel="Clear results"
        pending={pending}
        onConfirm={() => confirm && runAction(confirm, true)}
      />
    </div>
  );
}
