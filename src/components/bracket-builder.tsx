"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteSquad } from "@/actions/brackets";
import { saveCompetitionSetting } from "@/actions/setup";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntrantsPicker } from "@/components/entrants-picker";
import { OptionSelect } from "@/components/option-select";
import { ResponsiveSheetDialog } from "@/components/responsive-sheet-dialog";
import { SquadForm } from "@/components/squad-form";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { isBye } from "@/lib/bracket/formats";
import { type EntrantKind, squadLabel } from "@/lib/bracket/squads";
import type { Bracket } from "@/lib/bracket/types";
import { groupRounds, matchName } from "@/lib/bracket/view";
import type { MutationResult } from "@/mutations/types";
import type { BracketEntrant, SquadRow } from "@/queries/brackets";

type Target = {
  id: string;
  name: string;
  team: string | null;
  /** A Participant's Team id, for the Squad form's Team filter. */
  teamId?: string | null;
};

/** A Bracket write and what it says when it's done. */
type BracketAction = {
  run: () => Promise<MutationResult>;
  success: string;
};

/** Same Entrants, in any order (Generate reorders them by Seed Position). */
function sameSet(a: string[], b: string[]) {
  const set = new Set(b);
  return a.length === b.length && a.every((id) => set.has(id));
}

/** "Red · Ashley Schuliger, Sam Schantz": a Squad's detail in a list. */
function squadDetail(squad: SquadRow): string {
  return squadLabel({ ...squad, name: "" });
}

/**
 * A Bracket's Entrants, in its Competition page's run area: a team
 * Competition's Squads, the Entrants ("All Teams", "All Squads" or picked
 * ones for team scoring, picked Participants for individual), their Seed
 * Positions with Generate / Re-roll, and a preview of Round 1. Its settings
 * (match size, self-report, enrollment) are in the page's Settings. Saving
 * Entrants and Generate go through the per-field save, so once a Match has
 * a result they're locked (`entrantsLock`, shown with its reason).
 */
export function BracketBuilder({
  competition,
  entrants,
  bracket,
  teams,
  participants,
  squads,
  teamLabel,
  entrantsLock,
}: {
  competition: {
    id: string;
    name: string;
    scoring: "team" | "individual";
  };
  /** The saved Entrants, by Seed Position. */
  entrants: BracketEntrant[];
  bracket: Bracket;
  teams: Target[];
  participants: Target[];
  /** The Competition's Squads, by name. */
  squads: SquadRow[];
  teamLabel: string;
  /** Why the Entrants and the Bracket can't change now, or null. */
  entrantsLock: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isTeam = competition.scoring === "team";
  const saved = entrants.map(
    (e) => (e.teamId ?? e.participantId ?? e.squadId)!,
  );
  const savedKind: EntrantKind = entrants.some((e) => e.squadId !== null)
    ? "squad"
    : isTeam
      ? "team"
      : "participant";
  const [kind, setKind] = useState<EntrantKind>(savedKind);
  const [selected, setSelected] = useState<string[]>(saved);
  const [squadSheet, setSquadSheet] = useState<SquadRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<SquadRow | null>(null);
  const dirty =
    !sameSet(selected, saved) || (kind !== savedKind && selected.length > 0);
  const bySquads = kind === "squad";
  // "Entrants are" shows once there's a Squad to choose, or Squads are saved.
  const showKind = isTeam && (squads.length > 0 || savedKind === "squad");
  const locked = entrantsLock !== null;
  const generated = bracket.matches.length > 0;

  function runAction(action: BracketAction) {
    startTransition(async () => {
      const result = await action.run();
      if (result.ok) {
        toast.success(action.success);
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  function changeKind(next: string) {
    const nextKind = next as EntrantKind;
    setKind(nextKind);
    setSelected(nextKind === savedKind ? saved : []);
  }

  function removeSquad(squad: SquadRow) {
    startTransition(async () => {
      const result = await deleteSquad(competition.id, squad.id);
      setDeleting(null);
      if (result.ok) {
        toast.success("Squad deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const items = bySquads
    ? squads.map((squad) => ({
        id: squad.id,
        label: squad.name,
        detail: squadDetail(squad),
      }))
    : (isTeam ? teams : participants).map((t) => ({
        id: t.id,
        label: t.name,
        detail: t.team ?? undefined,
      }));
  const editing = squadSheet === "new" ? undefined : (squadSheet ?? undefined);
  // Participant id → the other Squad they're in, for the Squad form.
  const taken: Record<string, string> = Object.fromEntries(
    squads
      .filter((squad) => squad.id !== editing?.id)
      .flatMap((squad) => squad.participants.map((p) => [p.id, squad.name])),
  );
  const firstRound = groupRounds(bracket)[0];
  const labelOf = (entrantId: string | null) =>
    entrants.find((e) => e.id === entrantId)?.label ?? "Unknown";

  return (
    <div className="flex flex-col gap-8">
      {entrantsLock && (
        <p
          className="border-border rounded-lg border px-3 py-2 text-sm"
          data-slot="lock-reason"
        >
          Entrants and Seed Positions: {entrantsLock}
        </p>
      )}

      {
        <>
          {isTeam && (
            <section className="flex flex-col gap-3" aria-label="Squads">
              <h2 className="text-lg font-semibold">Squads</h2>
              <p className="text-foreground/70 text-sm">
                A Squad is a named group of Participants from one {teamLabel},
                entered as one Entrant. Its Placement Points go to its{" "}
                {teamLabel}.
              </p>
              <p className="text-foreground/60 text-xs">
                Squad: a pair or group from one Team, playing as one entrant
              </p>
              {squads.length === 0 ? (
                <p className="text-foreground/70 text-sm">No Squads yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {squads.map((squad) => (
                    <li
                      key={squad.id}
                      className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
                    >
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor: squad.teamColor ?? "transparent",
                        }}
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {squadLabel(squad)}
                      </span>
                      <span className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="min-h-11 sm:min-h-9"
                          disabled={pending || locked}
                          aria-label={`Edit ${squad.name}`}
                          onClick={() => setSquadSheet(squad)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="min-h-11 sm:min-h-9"
                          disabled={pending || locked}
                          aria-label={`Delete ${squad.name}`}
                          onClick={() => setDeleting(squad)}
                        >
                          Delete
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 w-fit"
                disabled={pending || locked}
                onClick={() => setSquadSheet("new")}
              >
                Add Squad
              </Button>
            </section>
          )}

          <EntrantsPicker
            id="bracket-entrants"
            description={
              <>
                {!isTeam
                  ? "An individual Competition, so its Entrants are Participants."
                  : bySquads
                    ? `A ${teamLabel} Competition entering Squads; each Squad's points go to its ${teamLabel}.`
                    : `A ${teamLabel} Competition, so its Entrants are ${teamLabel}s.`}{" "}
                Saving new Entrants clears the Bracket.
              </>
            }
            kind={kind}
            kindLabel={teamLabel}
            options={items}
            selected={selected}
            onChange={setSelected}
            onSave={() =>
              runAction({
                run: () =>
                  saveCompetitionSetting(competition.id, {
                    field: "entrants",
                    value: { kind, targetIds: selected },
                  }),
                success: "Entrants saved",
              })
            }
            disabled={pending || locked}
            saveDisabled={!dirty}
            note={
              <>
                {showKind && (
                  <Field className="max-w-xs">
                    <FieldLabel htmlFor="bracket-entrant-kind">
                      Entrants are
                    </FieldLabel>
                    <OptionSelect
                      id="bracket-entrant-kind"
                      options={[
                        { value: "team", label: `${teamLabel}s` },
                        { value: "squad", label: "Squads" },
                      ]}
                      value={kind}
                      disabled={pending || locked}
                      onValueChange={changeKind}
                    />
                  </Field>
                )}
                {isTeam && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="min-h-11 w-fit"
                    disabled={pending || locked}
                    onClick={() =>
                      setSelected((bySquads ? squads : teams).map((t) => t.id))
                    }
                  >
                    {bySquads ? "All Squads" : `All ${teamLabel}s`}
                  </Button>
                )}
              </>
            }
          />

          <section className="flex flex-col gap-3" aria-label="Seed Positions">
            <h2 className="text-lg font-semibold">Seed Positions</h2>
            <p className="text-foreground/70 text-sm">
              Seed Positions are drawn at random; Re-roll draws them again. Top
              Seed Positions get any byes.
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                variant={generated ? "outline" : "default"}
                className="min-h-11 w-fit"
                disabled={pending || locked || dirty || entrants.length < 2}
                onClick={() =>
                  runAction({
                    run: () =>
                      saveCompetitionSetting(competition.id, {
                        field: "bracket",
                        value: null,
                      }),
                    success: generated
                      ? "Bracket re-rolled"
                      : "Bracket generated",
                  })
                }
              >
                {generated ? "Re-roll" : "Generate"}
              </Button>
            </div>
          </section>

          {firstRound && (
            <section className="flex flex-col gap-3" aria-label="Preview">
              <h2 className="text-lg font-semibold">
                Preview · {firstRound.name}
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                {firstRound.matches.map((match) => {
                  const names = match.slots
                    .filter((s) => s.entrantId !== null)
                    .map((s) => labelOf(s.entrantId));
                  return (
                    <li key={match.id} className="flex min-w-0 flex-col">
                      <span className="text-foreground/60 text-xs font-medium">
                        {matchName(bracket, match)}
                      </span>
                      <span className="break-words">
                        {isBye(bracket, match)
                          ? `${names.join(", ")} · Bye — advances`
                          : names.join(" vs ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      }

      <ResponsiveSheetDialog
        open={squadSheet !== null}
        onOpenChange={(open) => {
          if (!open) setSquadSheet(null);
        }}
      >
        {squadSheet !== null && (
          <SquadForm
            key={editing?.id ?? "new"}
            competitionId={competition.id}
            squad={editing}
            teams={teams}
            participants={participants.map((p) => ({
              id: p.id,
              name: p.name,
              teamId: p.teamId ?? null,
            }))}
            taken={taken}
            teamLabel={teamLabel}
            entered={
              editing !== undefined &&
              entrants.some((e) => e.squadId === editing.id)
            }
            onDone={() => setSquadSheet(null)}
          />
        )}
      </ResponsiveSheetDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={deleting ? `Delete Squad "${deleting.name}"?` : ""}
        description="Its Participants stay on the roster. A Squad that is an Entrant can't be deleted."
        pending={pending}
        onConfirm={() => deleting && removeSquad(deleting)}
      />
    </div>
  );
}
