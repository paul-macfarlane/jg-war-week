"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import {
  closeGames,
  reopenGames,
  setGamesEntrants,
  setGamesSettings,
} from "@/actions/games";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { DatePicker } from "@/components/date-picker";
import {
  EntrantsPicker,
  type EntrantsPickerItem,
} from "@/components/entrants-picker";
import { fieldErrorsOf, formErrorOf } from "@/components/form-field-errors";
import { OptionSelect } from "@/components/option-select";
import { TimeCombobox } from "@/components/time-combobox";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { EntrantKind } from "@/lib/bracket/squads";
import { hasPlacementPoints } from "@/lib/competitions";
import type { GameFormat } from "@/lib/enums";
import {
  BEST_OF_OPTIONS,
  type BestScoreConfig,
  type GamesConfig,
  type HeadToHeadConfig,
  bestOfLabel,
  gameFormatLabel,
} from "@/lib/games/config";
import { enrollmentUnavailable } from "@/lib/games/enroll-rule";
import { placementPointsList } from "@/lib/games/view";
import { fromEasternClock, toEasternClock } from "@/lib/schedule";
import type { MutationResult } from "@/mutations/types";

const BEST_OF_SELECT_OPTIONS = [
  { value: "off", label: bestOfLabel(null) },
  ...BEST_OF_OPTIONS.map((n) => ({ value: String(n), label: bestOfLabel(n) })),
];

type Target = { id: string; name: string; team: string | null };

type SettingsFields = {
  drawsAllowed: boolean;
  bestOf: "off" | "3" | "5" | "7";
  count: "best" | "total";
  betterIs: "higher" | "lower";
  unit: string;
  entrantsOpen: boolean;
  loggingClosesAtDate: string;
  loggingClosesAtTime: string;
  selfEnroll: boolean;
  entrantLimit: string;
  enrollClosesAtDate: string;
  enrollClosesAtTime: string;
};

function clockOf(date: Date | null): { date: string; time: string } {
  if (!date) return { date: "", time: "" };
  const clock = toEasternClock(date);
  return { date: clock.date, time: clock.time.slice(0, 5) };
}

/** The settings form's starting values, from the saved Competition. */
function initialFields(
  gameFormat: GameFormat,
  config: GamesConfig,
  entrantsOpen: boolean,
  loggingClosesAt: Date | null,
  enroll: {
    selfEnroll: boolean;
    entrantLimit: number | null;
    enrollClosesAt: Date | null;
  },
): SettingsFields {
  const h2h =
    gameFormat === "head-to-head" ? (config as HeadToHeadConfig) : null;
  const bestScore =
    gameFormat === "best-score" ? (config as BestScoreConfig) : null;
  const logging = clockOf(loggingClosesAt);
  const closes = clockOf(enroll.enrollClosesAt);
  return {
    drawsAllowed: h2h?.drawsAllowed ?? false,
    bestOf: h2h?.bestOf ? (String(h2h.bestOf) as "3" | "5" | "7") : "off",
    count: bestScore?.count ?? "best",
    betterIs: bestScore?.betterIs ?? "higher",
    unit: bestScore?.unit ?? "",
    entrantsOpen,
    loggingClosesAtDate: logging.date,
    loggingClosesAtTime: logging.time,
    selfEnroll: enroll.selfEnroll,
    entrantLimit:
      enroll.entrantLimit !== null ? String(enroll.entrantLimit) : "",
    enrollClosesAtDate: closes.date,
    enrollClosesAtTime: closes.time,
  };
}

/** The raw shape `parseGamesSettingsInput` (`src/lib/games/input.ts`) expects. */
function rawSettingsOf(gameFormat: GameFormat, fields: SettingsFields) {
  const loggingClosesAt = fromEasternClock(
    fields.loggingClosesAtDate,
    fields.loggingClosesAtTime,
  );
  const enrollClosesAt = fromEasternClock(
    fields.enrollClosesAtDate,
    fields.enrollClosesAtTime,
  );
  return {
    gameFormat,
    drawsAllowed: fields.drawsAllowed,
    bestOf: fields.bestOf,
    count: fields.count,
    betterIs: fields.betterIs,
    unit: fields.unit,
    entrantsOpen: fields.entrantsOpen,
    loggingClosesAt: loggingClosesAt ? loggingClosesAt.toISOString() : null,
    selfEnroll: fields.selfEnroll,
    entrantLimit: fields.entrantLimit,
    enrollClosesAt: enrollClosesAt ? enrollClosesAt.toISOString() : null,
  };
}

/**
 * The `games` Competition's setup: its Game Type (fixed) and settings, its
 * Entrants (open or a fixed list, R3 decision 11), the logging close time,
 * self-enrollment (decision 12) and Close / Reopen (decision 1).
 */
export function GamesBuilder({
  competition,
  entrants,
  teams,
  participants,
  enroll,
}: {
  competition: {
    id: string;
    name: string;
    scoring: "team" | "individual";
    gameFormat: GameFormat;
    config: GamesConfig;
    entrantsOpen: boolean;
    loggingClosesAt: Date | null;
    closed: boolean;
    placementPoints: number[] | null;
    bestOfDecided: boolean;
    bestOfWinner: string | null;
  };
  /** The saved fixed-list Entrants, by Team or Participant id. */
  entrants: { teamId: string | null; participantId: string | null }[];
  teams: Target[];
  participants: Target[];
  enroll: {
    selfEnroll: boolean;
    entrantLimit: number | null;
    enrollClosesAt: Date | null;
  };
}) {
  const router = useRouter();
  const { gameFormat } = competition;
  const isTeam = competition.scoring === "team";
  const kind: EntrantKind = isTeam ? "team" : "participant";

  const savedFields = initialFields(
    gameFormat,
    competition.config,
    competition.entrantsOpen,
    competition.loggingClosesAt,
    enroll,
  );
  const [fields, setFields] = useState<SettingsFields>(savedFields);
  // After a save, `router.refresh()` hands this form the saved values as new
  // props; the fields follow them instead of keeping what was first loaded.
  const savedKey = JSON.stringify(savedFields);
  const [lastSavedKey, setLastSavedKey] = useState(savedKey);
  if (savedKey !== lastSavedKey) {
    setLastSavedKey(savedKey);
    setFields(savedFields);
  }
  function set<K extends keyof SettingsFields>(
    key: K,
    value: SettingsFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  const [result, formAction, saving] = useActionState(
    async (): Promise<MutationResult> => {
      const raw = rawSettingsOf(gameFormat, fields);
      const saved = await setGamesSettings(competition.id, raw);
      if (saved.ok) {
        toast.success("Games settings saved");
        router.refresh();
      } else {
        toast.error(saved.error);
      }
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);

  const savedEntrantIds = entrants.map((e) => (e.teamId ?? e.participantId)!);
  const [selected, setSelected] = useState<string[]>(savedEntrantIds);
  const dirty =
    selected.length !== savedEntrantIds.length ||
    !selected.every((id) => savedEntrantIds.includes(id));
  const [savingEntrants, setSavingEntrants] = useState(false);

  const items: EntrantsPickerItem[] = (isTeam ? teams : participants).map(
    (t) => ({ id: t.id, label: t.name, detail: t.team ?? undefined }),
  );

  // A Best of is played between a fixed list's two Entrants.
  const fixedForced = fields.bestOf !== "off";
  const entrantsFixed = !fields.entrantsOpen;
  const showsEnroll =
    enrollmentUnavailable({
      format: gameFormat,
      entrantsOpen: fields.entrantsOpen,
      gameConfig:
        gameFormat === "head-to-head"
          ? {
              drawsAllowed: fields.drawsAllowed,
              bestOf: fixedForced ? (Number(fields.bestOf) as 3 | 5 | 7) : null,
            }
          : null,
    }) === null;
  const locked = competition.closed;

  async function saveEntrants() {
    setSavingEntrants(true);
    const saved = await setGamesEntrants(competition.id, {
      kind,
      targetIds: selected,
    });
    setSavingEntrants(false);
    if (saved.ok) {
      toast.success("Entrants saved");
      router.refresh();
    } else {
      toast.error(saved.error);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{competition.name}</h1>
        <p className="text-foreground/70 text-sm">
          Games · {gameFormatLabel(gameFormat)}
        </p>
      </div>

      {competition.bestOfDecided && !locked && (
        <p className="border-primary bg-primary/5 rounded-lg border px-3 py-2 text-sm font-medium">
          Best of decided: {competition.bestOfWinner} — Close it.
        </p>
      )}

      {locked && (
        <p className="border-border rounded-lg border px-3 py-2 text-sm">
          This Competition is closed. Reopen it to change its Games or settings.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-6">
        {gameFormat === "head-to-head" && (
          <FieldSet>
            <FieldLegend>Settings</FieldLegend>
            <FieldGroup className="gap-4 sm:flex-row">
              <Field orientation="horizontal" className="sm:max-w-56">
                <Switch
                  id="games-draws-allowed"
                  checked={fields.drawsAllowed}
                  disabled={saving || locked}
                  onCheckedChange={(on) => set("drawsAllowed", on)}
                />
                <FieldContent>
                  <FieldLabel htmlFor="games-draws-allowed">
                    Draws allowed
                  </FieldLabel>
                </FieldContent>
              </Field>
              <Field className="sm:max-w-48">
                <FieldLabel htmlFor="games-best-of">Best of</FieldLabel>
                <OptionSelect
                  id="games-best-of"
                  options={BEST_OF_SELECT_OPTIONS}
                  value={fields.bestOf}
                  disabled={saving || locked}
                  onValueChange={(value) => {
                    const bestOf = value as SettingsFields["bestOf"];
                    setFields((current) => ({
                      ...current,
                      bestOf,
                      entrantsOpen:
                        bestOf !== "off" ? false : current.entrantsOpen,
                    }));
                  }}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        )}

        {gameFormat === "best-score" && (
          <FieldSet>
            <FieldLegend>Settings</FieldLegend>
            <FieldGroup className="gap-4 sm:flex-row">
              <Field className="sm:max-w-48">
                <FieldLabel htmlFor="games-count">Count</FieldLabel>
                <OptionSelect
                  id="games-count"
                  options={[
                    { value: "best", label: "Best" },
                    { value: "total", label: "Total" },
                  ]}
                  value={fields.count}
                  disabled={saving || locked}
                  onValueChange={(value) =>
                    set("count", value as "best" | "total")
                  }
                />
              </Field>
              <Field className="sm:max-w-48">
                <FieldLabel htmlFor="games-better-is">Better is</FieldLabel>
                <OptionSelect
                  id="games-better-is"
                  options={[
                    { value: "higher", label: "Higher" },
                    { value: "lower", label: "Lower" },
                  ]}
                  value={fields.betterIs}
                  disabled={saving || locked}
                  onValueChange={(value) =>
                    set("betterIs", value as "higher" | "lower")
                  }
                />
              </Field>
              <Field className="sm:max-w-48" data-invalid={!!fieldErrors.unit}>
                <FieldLabel htmlFor="games-unit">Unit</FieldLabel>
                <Input
                  id="games-unit"
                  maxLength={20}
                  className="h-11 sm:h-9"
                  disabled={saving || locked}
                  aria-invalid={!!fieldErrors.unit}
                  value={fields.unit}
                  onChange={(event) => set("unit", event.target.value)}
                />
                <FieldError>{fieldErrors.unit}</FieldError>
              </Field>
            </FieldGroup>
          </FieldSet>
        )}

        <Field className="max-w-xs">
          <FieldLabel htmlFor="games-entrants-open">Entrants</FieldLabel>
          <OptionSelect
            id="games-entrants-open"
            options={[
              { value: "open", label: "Open to everyone" },
              { value: "fixed", label: "A fixed list" },
            ]}
            value={fields.entrantsOpen ? "open" : "fixed"}
            disabled={saving || locked || fixedForced}
            onValueChange={(value) => set("entrantsOpen", value === "open")}
          />
          {fixedForced && (
            <FieldDescription>
              Best of needs a fixed list of exactly two Entrants.
            </FieldDescription>
          )}
        </Field>

        <FieldGroup className="gap-4 sm:flex-row">
          <Field className="sm:max-w-48">
            <FieldLabel htmlFor="games-logging-closes-date">
              Logging closes
            </FieldLabel>
            <DatePicker
              id="games-logging-closes-date"
              name="loggingClosesAtDate"
              value={fields.loggingClosesAtDate}
              onValueChange={(value) => set("loggingClosesAtDate", value)}
            />
          </Field>
          <Field className="sm:max-w-40">
            <FieldLabel htmlFor="games-logging-closes-time">
              Time (ET)
            </FieldLabel>
            <TimeCombobox
              id="games-logging-closes-time"
              name="loggingClosesAtTime"
              value={fields.loggingClosesAtTime}
              onValueChange={(value) => set("loggingClosesAtTime", value)}
            />
          </Field>
        </FieldGroup>
        <FieldDescription>
          Participants can&apos;t log after this. Awards nothing — press Close.
        </FieldDescription>

        {showsEnroll && (
          <Field orientation="horizontal" className="max-w-xl">
            <Switch
              id="games-self-enroll"
              checked={fields.selfEnroll}
              disabled={saving || locked}
              onCheckedChange={(on) => set("selfEnroll", on)}
            />
            <FieldContent>
              <FieldLabel htmlFor="games-self-enroll">
                Participants can enroll
              </FieldLabel>
              <FieldDescription>
                Participants enter themselves until the Entrant limit is
                reached, the close time passes, the first Game is logged, or you
                close this Competition.
              </FieldDescription>
            </FieldContent>
          </Field>
        )}
        {showsEnroll && fields.selfEnroll && (
          <FieldGroup className="gap-4 sm:flex-row">
            <Field className="sm:max-w-48">
              <FieldLabel htmlFor="games-enroll-limit">
                Entrant limit
              </FieldLabel>
              <Input
                id="games-enroll-limit"
                type="number"
                inputMode="numeric"
                min={2}
                className="h-11 sm:h-9"
                disabled={saving || locked}
                aria-invalid={!!fieldErrors.entrantLimit}
                value={fields.entrantLimit}
                onChange={(event) => set("entrantLimit", event.target.value)}
              />
              <FieldError>{fieldErrors.entrantLimit}</FieldError>
            </Field>
            <Field className="sm:max-w-48">
              <FieldLabel htmlFor="games-enroll-closes-date">
                Enrollment closes
              </FieldLabel>
              <DatePicker
                id="games-enroll-closes-date"
                name="enrollClosesAtDate"
                value={fields.enrollClosesAtDate}
                onValueChange={(value) => set("enrollClosesAtDate", value)}
              />
            </Field>
            <Field className="sm:max-w-40">
              <FieldLabel htmlFor="games-enroll-closes-time">
                Time (ET)
              </FieldLabel>
              <TimeCombobox
                id="games-enroll-closes-time"
                name="enrollClosesAtTime"
                value={fields.enrollClosesAtTime}
                onValueChange={(value) => set("enrollClosesAtTime", value)}
              />
            </Field>
          </FieldGroup>
        )}

        {formError && <FieldError>{formError}</FieldError>}
        <Button
          type="submit"
          size="lg"
          className="min-h-11 w-fit"
          disabled={saving || locked}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>

      {entrantsFixed && (
        <EntrantsPicker
          id="games-entrants"
          description={
            !isTeam
              ? "An individual Competition, so its Entrants are Participants."
              : "A team Competition, so its Entrants are Teams."
          }
          kind={kind}
          options={items}
          selected={selected}
          onChange={setSelected}
          onSave={saveEntrants}
          disabled={savingEntrants || locked}
          saveDisabled={!dirty}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {competition.closed ? (
          <>
            <p className="text-foreground/70 text-sm">
              {hasPlacementPoints(competition.placementPoints)
                ? "Closed: its Points Entries are in the ledger."
                : "Closed: it has no Placement Points, so it made no Points Entries."}{" "}
              Reopen to log more Games.
            </p>
            <ConfirmActionButton
              title="Reopen this Competition?"
              description={
                hasPlacementPoints(competition.placementPoints)
                  ? "The generated Points Entries are withdrawn; hand-entered ones stay."
                  : "Players can log Games again."
              }
              confirmLabel="Reopen"
              action={() => reopenGames(competition.id)}
              successMessage="Competition reopened"
              variant="outline"
              size="lg"
              className="min-h-11"
            >
              Reopen
            </ConfirmActionButton>
          </>
        ) : (
          <ConfirmActionButton
            title="Close this Competition?"
            description={`The leaderboard's top places get Placement Points (${placementPointsList(
              competition.placementPoints,
            )}) and logging stops.`}
            confirmLabel="Close"
            action={() => closeGames(competition.id)}
            successMessage="Competition closed"
            variant="default"
            size="lg"
            className="min-h-11"
          >
            Close
          </ConfirmActionButton>
        )}
      </div>
    </div>
  );
}
