"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type BracketActionResult,
  deleteSquad,
  generateBracket,
  replaceEntrants,
  setCompetitionFormat,
} from "@/actions/brackets";
import { setSelfEnroll } from "@/actions/enrollment";
import { setSelfReport } from "@/actions/heat-reports";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import { EntrantsPicker } from "@/components/entrants-picker";
import { OptionSelect } from "@/components/option-select";
import { SquadForm } from "@/components/squad-form";
import { TimeCombobox } from "@/components/time-combobox";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  ADVANCE_PER_HEAT_OPTIONS,
  ENTRANTS_PER_HEAT_OPTIONS,
  type HeatsConfig,
  advancePerHeatLabel,
  entrantsPerHeatLabel,
  heatsConfig as heatsConfigOf,
} from "@/lib/bracket/config";
import { hasResults, isBye, validateConfig } from "@/lib/bracket/formats";
import { type EntrantKind, squadLabel } from "@/lib/bracket/squads";
import { type Bracket, HAS_RESULTS_ERROR } from "@/lib/bracket/types";
import {
  type Format,
  formatLabel,
  groupRounds,
  heatName,
  isTimed,
} from "@/lib/bracket/view";
import { COMPETITION_FORMATS } from "@/lib/enums";
import { fromEasternClock, toEasternClock } from "@/lib/schedule";
import type { BracketEntrant, SquadRow } from "@/queries/brackets";

type Target = {
  id: string;
  name: string;
  team: string | null;
  /** A Participant's Team id, for the Squad form's Team filter. */
  teamId?: string | null;
};

// Never `games`: a Competition is `games` from creation, and stays so.
const FORMAT_OPTIONS = COMPETITION_FORMATS.filter(
  (format) => format !== "games",
).map((format) => ({
  value: format,
  label: formatLabel(format),
}));

/** A write that may be refused for clearing Heat Results; retried with `force`. */
type ForceableAction = {
  run: (force: boolean) => Promise<BracketActionResult>;
  success: string;
  title: string;
  /** Overrides the confirm's body text; defaults to `HAS_RESULTS_ERROR`. */
  description?: string;
  /** Overrides the confirm button's label; defaults to "Clear results". */
  confirmLabel?: string;
};

/** The builder's confirm copy for a re-draw that would clear timed Heats. */
function timedHeatsMessage(count: number, hasExistingResults: boolean): string {
  const times = count === 1 ? "1 Heat time" : `${count} Heat times`;
  return hasExistingResults
    ? `This clears every Heat Result and ${times}.`
    : `This clears ${times}.`;
}

/** Drops the "Clear every Heat Result and " prefix when there are no results. */
function confirmTitle(title: string, hasExistingResults: boolean): string {
  if (hasExistingResults) return title;
  const rest = title.replace(/^Clear every Heat Result and /, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * The confirm's title, description and button label for a write that would
 * clear timed Heats (and, once there are Heat Results, clear those too):
 * null when there's nothing timed to warn about. Pure, so it's unit-tested
 * without rendering the builder.
 */
export function forceableConfirmCopy(
  timedHeatsCount: number,
  hasExistingResults: boolean,
  title: string,
): { title: string; description: string; confirmLabel: string } | null {
  if (timedHeatsCount === 0) return null;
  return {
    title: confirmTitle(title, hasExistingResults),
    description: timedHeatsMessage(timedHeatsCount, hasExistingResults),
    confirmLabel: hasExistingResults ? "Clear results" : "Clear times",
  };
}

/**
 * The Heats Format's settings: how many Entrants play in each Heat and how
 * many of them advance. With a saved Entrant count, a "how many advance"
 * that Generate would refuse is disabled, and the refusal is shown when the
 * current choice is one.
 */
function HeatSettingsForm({
  competitionId,
  config,
  entrantCount,
  disabled,
  timedHeatsCount,
  hasExistingResults,
  onRefused,
}: {
  competitionId: string;
  config: HeatsConfig;
  entrantCount: number;
  disabled: boolean;
  /** How many of the Bracket's Heats are timed; a re-draw would clear them. */
  timedHeatsCount: number;
  hasExistingResults: boolean;
  /** A save refused for clearing Heat Results: confirm, then force it. */
  onRefused: (action: ForceableAction) => void;
}) {
  const router = useRouter();
  const [perHeat, setPerHeat] = useState(config.entrantsPerHeat);
  const [advance, setAdvance] = useState(config.advancePerHeat);

  const [, formAction, saving] = useActionState(
    async (
      _previous: BracketActionResult | null,
      formData: FormData,
    ): Promise<BracketActionResult> => {
      const next = {
        entrantsPerHeat: Number(formData.get("entrantsPerHeat")),
        advancePerHeat: Number(formData.get("advancePerHeat")),
      };
      const run = (force: boolean) =>
        setCompetitionFormat(competitionId, {
          format: "heats",
          config: next,
          force,
        });
      const title = "Clear every Heat Result and save the Heat settings?";
      // Saving Heat settings rebuilds the Heats, clearing any set times: ask
      // first, whether or not there are Heat Results too (decision 3). An
      // unchanged save doesn't touch the Heats, so it skips the confirm.
      const settingsChange =
        next.entrantsPerHeat !== config.entrantsPerHeat ||
        next.advancePerHeat !== config.advancePerHeat;
      const copy = settingsChange
        ? forceableConfirmCopy(timedHeatsCount, hasExistingResults, title)
        : null;
      if (copy) {
        onRefused({ run, success: "Heat settings saved", ...copy });
        return _previous ?? { ok: true };
      }
      const result = await run(false);
      if (result.ok) {
        toast.success("Heat settings saved");
        router.refresh();
      } else if (result.error === HAS_RESULTS_ERROR) {
        onRefused({ run, success: "Heat settings saved", title });
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );

  const refusalAt = (entrantsPerHeat: number, advancePerHeat: number) =>
    entrantCount >= 2
      ? validateConfig(
          "heats",
          { entrantsPerHeat, advancePerHeat },
          entrantCount,
        )
      : null;
  const refusalFor = (advancePerHeat: number) =>
    refusalAt(perHeat, advancePerHeat);
  const refusal = refusalFor(advance);
  const perHeatOptions = ENTRANTS_PER_HEAT_OPTIONS.map((count) => ({
    value: String(count),
    label: entrantsPerHeatLabel(count),
  }));
  const advanceOptions = ADVANCE_PER_HEAT_OPTIONS.filter(
    (count) => count < perHeat,
  ).map((count) => {
    const reason = refusalFor(count);
    return {
      value: String(count),
      label: advancePerHeatLabel(count),
      disabled: reason !== null,
      title: reason ?? undefined,
    };
  });
  const off = disabled || saving;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldSet>
        <FieldLegend>Heat settings</FieldLegend>
        <FieldDescription>
          Each Round deals the Entrants into Heats; the top few of each go on to
          the next Round until one Heat, the Final, is left.
        </FieldDescription>
        <FieldGroup className="gap-4 sm:flex-row">
          <Field className="sm:max-w-48">
            <FieldLabel htmlFor="heat-entrants">Entrants per Heat</FieldLabel>
            <OptionSelect
              id="heat-entrants"
              name="entrantsPerHeat"
              options={perHeatOptions}
              value={String(perHeat)}
              disabled={off}
              onValueChange={(value) => {
                const size = Number(value);
                setPerHeat(size);
                // The most that can advance at this size, for these Entrants.
                const best = ADVANCE_PER_HEAT_OPTIONS.filter(
                  (count) => count < size && refusalAt(size, count) === null,
                ).at(-1);
                setAdvance(best ?? 1);
              }}
            />
          </Field>
          <Field className="sm:max-w-48" data-invalid={refusal !== null}>
            <FieldLabel htmlFor="heat-advance">How many advance</FieldLabel>
            <OptionSelect
              id="heat-advance"
              name="advancePerHeat"
              options={advanceOptions}
              value={String(advance)}
              disabled={off}
              aria-invalid={refusal !== null}
              onValueChange={(value) => setAdvance(Number(value))}
            />
          </Field>
        </FieldGroup>
        {refusal && <FieldDescription>{refusal}</FieldDescription>}
      </FieldSet>
      <Button
        type="submit"
        size="lg"
        className="min-h-11 w-fit"
        disabled={off || refusal !== null}
      >
        {saving ? "Saving…" : "Save Heat settings"}
      </Button>
    </form>
  );
}

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
 * The "Participants can enroll" switch, Entrant limit and close time
 * (`setSelfEnroll`, ADR 0006). The limit and close time save with the
 * switch, in one write.
 */
function SelfEnrollFields({
  competitionId,
  selfEnroll,
  entrantLimit,
  enrollClosesAt,
  disabled,
}: {
  competitionId: string;
  selfEnroll: boolean;
  entrantLimit: number | null;
  enrollClosesAt: Date | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(selfEnroll);
  const [limit, setLimit] = useState(
    entrantLimit !== null ? String(entrantLimit) : "",
  );
  const initialClock = enrollClosesAt ? toEasternClock(enrollClosesAt) : null;
  const [date, setDate] = useState(initialClock?.date ?? "");
  const [time, setTime] = useState(initialClock?.time.slice(0, 5) ?? "");

  const [, formAction, saving] = useActionState(
    async (): Promise<BracketActionResult> => {
      const closesAt = fromEasternClock(date, time);
      const result = await setSelfEnroll(competitionId, {
        on,
        entrantLimit: limit.trim() === "" ? null : limit,
        enrollClosesAt: closesAt ? closesAt.toISOString() : null,
      });
      if (result.ok) {
        toast.success(on ? "Enrollment on" : "Enrollment off");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      return result;
    },
    null,
  );
  const off = disabled || saving;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field orientation="horizontal" className="max-w-xl">
        <Switch
          id="bracket-self-enroll"
          checked={on}
          disabled={off}
          onCheckedChange={setOn}
        />
        <FieldContent>
          <FieldLabel htmlFor="bracket-self-enroll">
            Participants can enroll
          </FieldLabel>
          <FieldDescription>
            Participants enter themselves until the Bracket is built, the limit
            is reached or the close time passes.
          </FieldDescription>
        </FieldContent>
      </Field>
      {on && (
        <FieldGroup className="gap-4 sm:flex-row">
          <Field className="sm:max-w-48">
            <FieldLabel htmlFor="bracket-enroll-limit">
              Entrant limit
            </FieldLabel>
            <Input
              id="bracket-enroll-limit"
              type="number"
              inputMode="numeric"
              min={2}
              className="h-11 sm:h-9"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </Field>
          <Field className="sm:max-w-48">
            <FieldLabel htmlFor="bracket-enroll-date">Close date</FieldLabel>
            <DatePicker
              id="bracket-enroll-date"
              name="enrollClosesAtDate"
              value={date}
              onValueChange={setDate}
            />
          </Field>
          <Field className="sm:max-w-40">
            <FieldLabel htmlFor="bracket-enroll-time">
              Close time (ET)
            </FieldLabel>
            <TimeCombobox
              id="bracket-enroll-time"
              name="enrollClosesAtTime"
              value={time}
              onValueChange={setTime}
            />
          </Field>
        </FieldGroup>
      )}
      <Button type="submit" size="lg" className="min-h-11 w-fit" disabled={off}>
        {saving ? "Saving…" : "Save enrollment settings"}
      </Button>
    </form>
  );
}

/**
 * The Bracket builder: the Format, a team Competition's Squads, the
 * Entrants ("All Teams", "All Squads" or picked ones for team scoring,
 * picked Participants for individual), their Seed Positions with Generate /
 * Re-roll, whether Participants may self-report, and a preview of Round 1.
 */
export function BracketBuilder({
  competition,
  entrants,
  bracket,
  teams,
  participants,
  squads,
  teamLabel,
}: {
  competition: {
    id: string;
    name: string;
    scoring: "team" | "individual";
    format: Format;
    finalized: boolean;
    selfReport: boolean;
    selfEnroll: boolean;
    entrantLimit: number | null;
    enrollClosesAt: Date | null;
  };
  /** The saved Entrants, by Seed Position. */
  entrants: BracketEntrant[];
  bracket: Bracket;
  teams: Target[];
  participants: Target[];
  /** The Competition's Squads, by name. */
  squads: SquadRow[];
  teamLabel: string;
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
  const [confirm, setConfirm] = useState<ForceableAction | null>(null);
  const [squadSheet, setSquadSheet] = useState<SquadRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<SquadRow | null>(null);
  const [selfReport, setSelfReportOn] = useState(competition.selfReport);
  const dirty =
    !sameSet(selected, saved) || (kind !== savedKind && selected.length > 0);
  const bySquads = kind === "squad";
  // "Entrants are" shows once there's a Squad to choose, or Squads are saved.
  const showKind = isTeam && (squads.length > 0 || savedKind === "squad");
  const standingsOffered = savedKind !== "squad" && !bySquads;
  const locked = competition.finalized;
  const generated = bracket.heats.length > 0;
  const timedHeatsCount = bracket.heats.filter(isTimed).length;
  const existingResults = hasResults(bracket);

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

  /**
   * Generate / Re-roll / By Standings / Save Entrants rebuild the Heats, so
   * they clear any set Heat times: ask first when there are any, whether or
   * not the Bracket also has Heat Results (decision 3). Without a timed
   * Heat, this runs the write directly, as today.
   */
  function startAction(action: ForceableAction) {
    const copy = forceableConfirmCopy(
      timedHeatsCount,
      existingResults,
      action.title,
    );
    if (copy) {
      setConfirm({ ...action, ...copy });
      return;
    }
    runAction(action);
  }

  function changeKind(next: string) {
    const nextKind = next as EntrantKind;
    setKind(nextKind);
    setSelected(nextKind === savedKind ? saved : []);
  }

  function toggleSelfReport(on: boolean) {
    startTransition(async () => {
      const result = await setSelfReport(competition.id, { on });
      if (result.ok) {
        setSelfReportOn(on);
        toast.success(on ? "Self-report on" : "Self-report off");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
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
  const heatsConfig =
    competition.format === "heats" ? heatsConfigOf(bracket.config) : null;

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

      {heatsConfig && (
        <HeatSettingsForm
          // A saved change (after the refresh) starts the form from it.
          key={`${heatsConfig.entrantsPerHeat}-${heatsConfig.advancePerHeat}`}
          competitionId={competition.id}
          config={heatsConfig}
          entrantCount={entrants.length}
          disabled={pending || locked}
          timedHeatsCount={timedHeatsCount}
          hasExistingResults={existingResults}
          onRefused={setConfirm}
        />
      )}

      {competition.format !== "points" && (
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
              startAction({
                run: (force) =>
                  replaceEntrants(competition.id, {
                    kind,
                    targetIds: selected,
                    force,
                  }),
                success: "Entrants saved",
                title: "Clear every Heat Result and save the Entrants?",
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
              {standingsOffered
                ? "Random, or by the current Standings (ties drawn at random)."
                : "Squads are seeded at random."}{" "}
              Top Seed Positions get any byes.
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
                  startAction({
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
              {standingsOffered && (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="min-h-11 w-fit"
                  disabled={pending || locked || dirty || entrants.length < 2}
                  onClick={() =>
                    startAction({
                      run: (force) =>
                        generateBracket(competition.id, {
                          seeding: "standings",
                          force,
                        }),
                      success: "Seed Positions drawn by Standings",
                      title:
                        "Clear every Heat Result and draw Seed Positions by Standings?",
                    })
                  }
                >
                  By Standings
                </Button>
              )}
            </div>
          </section>

          <Field orientation="horizontal" className="max-w-xl">
            <Switch
              id="bracket-self-report"
              checked={selfReport}
              disabled={pending}
              onCheckedChange={toggleSelfReport}
            />
            <FieldContent>
              <FieldLabel htmlFor="bracket-self-report">Self-report</FieldLabel>
              <FieldDescription>
                Participants in a Heat can enter its result from their phone. It
                counts at once; you can still change any result on the results
                screen.
              </FieldDescription>
            </FieldContent>
          </Field>

          <SelfEnrollFields
            key={`${competition.selfEnroll}-${competition.entrantLimit}-${competition.enrollClosesAt?.getTime()}`}
            competitionId={competition.id}
            selfEnroll={competition.selfEnroll}
            entrantLimit={competition.entrantLimit}
            enrollClosesAt={competition.enrollClosesAt}
            disabled={pending || locked}
          />

          {firstRound && (
            <section className="flex flex-col gap-3" aria-label="Preview">
              <h2 className="text-lg font-semibold">
                Preview · {firstRound.name}
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                {firstRound.heats.map((heat) => {
                  const names = heat.slots
                    .filter((s) => s.entrantId !== null)
                    .map((s) => labelOf(s.entrantId));
                  return (
                    <li key={heat.id} className="flex min-w-0 flex-col">
                      <span className="text-foreground/60 text-xs font-medium">
                        {heatName(bracket, heat)}
                      </span>
                      <span className="break-words">
                        {isBye(bracket, heat)
                          ? `${names.join(", ")} · Bye — advances`
                          : names.join(" vs ")}
                      </span>
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

      <Sheet
        open={squadSheet !== null}
        onOpenChange={(open) => {
          if (!open) setSquadSheet(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
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
        </SheetContent>
      </Sheet>

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

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? HAS_RESULTS_ERROR}
        confirmLabel={confirm?.confirmLabel ?? "Clear results"}
        pending={pending}
        onConfirm={() => confirm && runAction(confirm, true)}
      />
    </div>
  );
}
