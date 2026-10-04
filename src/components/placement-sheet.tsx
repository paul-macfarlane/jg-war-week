"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addEveryone,
  addPlacement,
  finalizePlacements,
  removePlacement,
  reopenPlacements,
  savePlacements,
} from "@/actions/placements";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { EntityCombobox } from "@/components/entity-combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { placementLabel } from "@/lib/competitions";
import type { ScoreDirection } from "@/lib/enums";
import { placementPointsByRow, refilledPlaces } from "@/lib/placement/score";
import { formatPoints } from "@/lib/points";
import type { MutationResult } from "@/mutations/types";

/** A row as the sheet shows it: names and numbers, never an email. */
export type PlacementSheetRow = {
  id: string;
  name: string;
  /** A Participant's Team name; null for a Team row or no Team. */
  team: string | null;
  place: number | null;
  score: number | null;
};

type Typed = { place: string; score: string };

const typedOf = (row: PlacementSheetRow): Typed => ({
  place: row.place === null ? "" : String(row.place),
  score: row.score === null ? "" : String(row.score),
});

/** A typed number, or null when blank or not a number. */
function numberOf(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** A typed Place, or null when blank or not a whole number from 1. */
function placeOf(text: string): number | null {
  const n = numberOf(text);
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * A Placement Competition's sheet (CONTEXT.md, Placement), the run area of
 * its Competition page: add people by search or Add everyone, give each
 * row a Place and an optional Score, Save, then Finalize into Points
 * Entries by the Placement Points; Reopen withdraws them. With a Score
 * direction (a setting in the page's Settings, saved on its own), Places
 * fill from Scores as they're typed and stay editable for ties and
 * judgement. Save sends only the rows, never the direction.
 */
export function PlacementSheet({
  competition,
  rows,
  candidates,
  teamLabel,
}: {
  competition: {
    id: string;
    scoring: "team" | "individual";
    placementPoints: number[] | null;
    scoreDirection: ScoreDirection;
    finalized: boolean;
  };
  rows: PlacementSheetRow[];
  /** Who the search can add: Teams, or Participants with their Team. */
  candidates: { id: string; name: string; team: string | null }[];
  teamLabel: string;
}) {
  const id = useId();
  const router = useRouter();
  const [running, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const pending = running || saving;
  const locked = competition.finalized;
  // A Finalized sheet has no Remove buttons, so no column for them.
  const columns = locked
    ? "grid-cols-[3.5rem_1fr_5.5rem_3rem]"
    : "grid-cols-[3.5rem_1fr_5.5rem_3rem_2.75rem]";
  const isTeam = competition.scoring === "team";

  // Unsaved edits by row id; anything not edited shows what's saved.
  const [edits, setEdits] = useState<Record<string, Typed>>({});
  const direction = competition.scoreDirection;
  const typed = (row: PlacementSheetRow) => edits[row.id] ?? typedOf(row);
  const changed = rows.filter((row) => {
    const now = typed(row);
    const saved = typedOf(row);
    return now.place !== saved.place || now.score !== saved.score;
  });
  const dirty = changed.length > 0;

  /** Every row's typed values, edited or saved. */
  const allTyped = (): Record<string, Typed> =>
    Object.fromEntries(rows.map((row) => [row.id, typed(row)]));
  const scoresOf = (all: Record<string, Typed>) =>
    rows.map((row) => ({ id: row.id, score: numberOf(all[row.id].score) }));
  /** Writes `places` into `all` as typed Places. */
  function withPlaces(all: Record<string, Typed>, places: Map<string, number>) {
    for (const [rowId, place] of places) {
      all[rowId] = { ...all[rowId], place: String(place) };
    }
    return all;
  }

  function setPlace(row: PlacementSheetRow, place: string) {
    setEdits((current) => ({
      ...current,
      [row.id]: { ...(current[row.id] ?? typedOf(row)), place },
    }));
  }

  /**
   * Sets a row's Score. With a direction, Places refill only where the
   * Scores moved them (`refilledPlaces`), so a Place typed to break a tie
   * survives another row's Score edit.
   */
  function setScore(row: PlacementSheetRow, score: string) {
    const all = allTyped();
    const before = scoresOf(all);
    all[row.id] = { ...all[row.id], score };
    setEdits(
      direction === "none"
        ? all
        : withPlaces(all, refilledPlaces(before, scoresOf(all), direction)),
    );
  }

  const points = new Map(
    placementPointsByRow(
      rows.map((row) => ({ id: row.id, place: placeOf(typed(row).place) })),
      competition,
    ).map((r) => [r.id, r.points]),
  );

  function run(
    action: () => Promise<MutationResult>,
    success: string,
    after?: () => void,
    start = startTransition,
  ) {
    start(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        after?.();
      } else {
        toast.error(result.error);
      }
      router.refresh();
    });
  }

  const [adding, setAdding] = useState("");
  function add(candidateId: string) {
    setAdding(candidateId);
    if (!candidateId) return;
    const who = candidates.find((c) => c.id === candidateId);
    run(
      () =>
        addPlacement(
          competition.id,
          isTeam ? { teamId: candidateId } : { participantId: candidateId },
        ),
      `${who?.name ?? "Row"} added`,
      () => setAdding(""),
    );
  }

  function save() {
    run(
      () =>
        savePlacements(competition.id, {
          rows: rows.map((row) => ({ id: row.id, ...typed(row) })),
        }),
      "Placements saved",
      () => setEdits({}),
      startSaving,
    );
  }

  const pointsLine =
    competition.placementPoints && competition.placementPoints.length > 0
      ? competition.placementPoints
          .map((p, i) => `${placementLabel(i + 1)} ${formatPoints(p)}`)
          .join(" · ")
      : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-foreground/70 text-sm">
        {pointsLine
          ? `Placement Points: ${pointsLine}`
          : "No Placement Points: Finalize gives no points. Set them in the Settings above."}
      </p>

      {locked ? (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          Finalized: its Points Entries are in the ledger. Reopen to change the
          sheet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field className="sm:max-w-xs">
              <FieldLabel htmlFor={`${id}-add`}>
                {isTeam ? `Add a ${teamLabel}` : "Add a Participant"}
              </FieldLabel>
              <EntityCombobox
                id={`${id}-add`}
                items={candidates.map((c) => ({
                  id: c.id,
                  label: c.name,
                  detail: c.team ?? undefined,
                }))}
                value={adding}
                onValueChange={add}
                placeholder="Search by name"
                emptyText={
                  candidates.length === 0
                    ? "Everyone is on the sheet."
                    : "No one matches."
                }
                disabled={pending}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11 w-fit sm:min-h-9"
              disabled={pending || candidates.length === 0}
              onClick={() =>
                run(() => addEveryone(competition.id), "Everyone added")
              }
            >
              Add everyone
            </Button>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-2" aria-labelledby={`${id}-sheet`}>
        <h2 id={`${id}-sheet`} className="text-lg font-semibold">
          Placements{" "}
          <span className="text-foreground/60 text-sm font-normal tabular-nums">
            ({rows.length})
          </span>
        </h2>
        {rows.length === 0 ? (
          <p className="text-foreground/70 text-sm">
            No one yet. Search above, or Add everyone.
          </p>
        ) : (
          <ol className="flex flex-col divide-y" aria-label="Placements">
            <li
              aria-hidden
              className={`text-foreground/60 grid ${columns} items-center gap-2 pb-1 text-xs`}
            >
              <span>Place</span>
              <span>Name</span>
              <span>Score</span>
              <span className="text-right">Points</span>
              {locked ? null : <span />}
            </li>
            {rows.map((row) => {
              const value = typed(row);
              const needsPlace =
                value.score.trim() !== "" && value.place.trim() === "";
              const earned = points.get(row.id);
              return (
                <li
                  key={row.id}
                  className={`grid ${columns} items-center gap-2 py-1.5`}
                >
                  <Input
                    aria-label={`Place for ${row.name}`}
                    inputMode="numeric"
                    className="h-11 px-2 text-center tabular-nums sm:h-9"
                    disabled={locked || pending}
                    aria-invalid={needsPlace}
                    value={value.place}
                    onChange={(event) => setPlace(row, event.target.value)}
                  />
                  <span className="flex min-w-0 flex-col">
                    {/* Wraps rather than truncates: at 390 a truncated
                        column cut even short names (ticket 106). */}
                    <span className="font-medium break-words">{row.name}</span>
                    {row.team || needsPlace ? (
                      <span className="text-foreground/60 truncate text-xs">
                        {needsPlace ? "Needs a Place" : row.team}
                      </span>
                    ) : null}
                  </span>
                  <Input
                    aria-label={`Score for ${row.name}`}
                    inputMode="decimal"
                    className="h-11 px-2 tabular-nums sm:h-9"
                    disabled={locked || pending}
                    value={value.score}
                    onChange={(event) => setScore(row, event.target.value)}
                  />
                  <span className="text-right font-semibold tabular-nums">
                    {earned === undefined ? "–" : formatPoints(earned)}
                  </span>
                  {locked ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 sm:size-9"
                      aria-label={`Remove ${row.name}`}
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            removePlacement(competition.id, {
                              placementId: row.id,
                            }),
                          `${row.name} removed`,
                          () =>
                            setEdits((current) => {
                              const next = { ...current };
                              delete next[row.id];
                              return next;
                            }),
                        )
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {locked ? (
          <ConfirmActionButton
            title="Reopen this Competition?"
            description="Its generated Points Entries are withdrawn so the sheet can change."
            confirmLabel="Reopen"
            action={() => reopenPlacements(competition.id)}
            successMessage="Competition reopened"
            variant="outline"
            size="lg"
            className="min-h-11"
          >
            Reopen
          </ConfirmActionButton>
        ) : (
          <>
            <Button
              type="button"
              variant={dirty ? "default" : "outline"}
              size="lg"
              className="min-h-11"
              disabled={!dirty || pending}
              onClick={save}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11"
                disabled
              >
                Finalize
              </Button>
            ) : (
              <ConfirmActionButton
                title="Finalize this Competition?"
                description={
                  pointsLine
                    ? `Each Place gets its Placement Points (${pointsLine}); tied rows each get their place's points, unplaced rows nothing.`
                    : "It has no Placement Points, so no points are given."
                }
                confirmLabel="Finalize"
                action={() => finalizePlacements(competition.id)}
                successMessage="Competition finalized"
                variant="default"
                size="lg"
                className="min-h-11"
              >
                Finalize
              </ConfirmActionButton>
            )}
            {dirty ? (
              <p className="text-foreground/70 text-sm">
                Save before you Finalize.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
