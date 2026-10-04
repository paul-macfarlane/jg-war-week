"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { saveCompetitionSetting } from "@/actions/setup";
import {
  AUTOSAVE_DELAY_MS,
  AutosaveStatusLine,
  useAutosaveLifecycle,
} from "@/components/autosave-status";
import { DatePicker } from "@/components/date-picker";
import { EntityCombobox } from "@/components/entity-combobox";
import { OptionSelect } from "@/components/option-select";
import { PlacementPointsRows } from "@/components/placement-points-rows";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SuggestionCombobox } from "@/components/suggestion-combobox";
import { TimeCombobox } from "@/components/time-combobox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import {
  type AutosaveSnapshot,
  createAutosave,
  sameValue,
} from "@/lib/autosave";
import {
  ADVANCE_PER_MATCH_OPTIONS,
  type BracketConfig,
  DEFAULT_BRACKET_CONFIG,
  ENTRANTS_PER_MATCH_OPTIONS,
  advancePerMatchLabel,
  entrantsPerMatchLabel,
  isHeadToHead,
  thirdPlaceRefusal,
} from "@/lib/bracket/config";
import { validateConfig } from "@/lib/bracket/formats";
import { formatLabel } from "@/lib/bracket/view";
import {
  type CompetitionLockFacts,
  settingLockReason,
  settingNote,
} from "@/lib/competition-locks";
import {
  type Clock,
  type CompetitionSettingsValues,
  FORMAT_DESCRIPTIONS,
  type SettingsField,
  settingChangeOf,
  shownSettings,
} from "@/lib/competition-page";
import {
  COMPETITION_GROUP_MAX,
  COMPETITION_NAME_MAX,
} from "@/lib/competition-settings";
import { placementLimit } from "@/lib/competitions";
import { COMPETITION_FORMATS, type GameFormat } from "@/lib/enums";
import {
  BEST_OF_OPTIONS,
  type BestOf,
  type BestScoreConfig,
  type HeadToHeadConfig,
  bestOfLabel,
  gamesConfigOf,
  resultNoun,
} from "@/lib/games/config";
import { type HostCandidate, buildHostOptions } from "@/lib/host-options";

/** What the leave confirm calls a refused field. */
const FIELD_LABELS: Record<SettingsField, string> = {
  name: "Name",
  description: "Description",
  group: "Group",
  hosts: "Hosts",
  placementPoints: "Placement Points",
  participationPoints: "Points per Participant",
  format: "Format",
  scoring: "Scoring",
  countsTowardTeam: "Counts toward the Team",
  scoreDirection: "Score direction",
  gameConfig: "The Format's settings",
  entrantsOpen: "Entrants",
  bracketConfig: "Match settings",
  selfEnroll: "Participants can enroll",
  entrantLimit: "Entrant limit",
  enrollClosesAt: "Enrollment closes",
  loggingClosesAt: "Logging closes",
  selfReport: "Self-report",
  selfCheckIn: "Participants can check in",
  checkInClosesAt: "Check-in closes",
};

const DIRECTION_OPTIONS = [
  { value: "none", label: "None: type or choose Places" },
  { value: "higher", label: "Higher Score wins" },
  { value: "lower", label: "Lower Score wins" },
] as const;

const BEST_OF_SELECT_OPTIONS = [
  { value: "off", label: bestOfLabel(null) },
  ...BEST_OF_OPTIONS.map((n) => ({ value: String(n), label: bestOfLabel(n) })),
];

/** A set of Host emails is the same in any order. */
function sameSetting(field: string, a: unknown, b: unknown): boolean {
  if (field === "hosts" && Array.isArray(a) && Array.isArray(b)) {
    return sameValue([...a].sort(), [...b].sort());
  }
  return sameValue(a, b);
}

/**
 * The admin Competition page's Settings (ticket 101): every setting of the
 * Competition, each saved on its own `AUTOSAVE_DELAY_MS` after the last
 * edit through `saveCompetitionSetting`, with "Saving…" / "Saved" beside
 * the heading as War Week settings has. A refused save shows at its field
 * and keeps the typed value. A locked field is disabled with its one-line
 * reason (`settingLockReason`), the same words the server refuses with.
 *
 * Seeded from the server's values (`initial`); when a save's refresh brings
 * new ones, every field not still waiting, saving or refused follows them
 * (a Format change's new defaults, say), and edits in progress stay.
 *
 * Leaving: an in-app navigation, the tab going hidden and `beforeunload`
 * send what's waiting; while a refusal shows, an in-app link asks first
 * (`useAutosaveLifecycle`).
 */
export function CompetitionSettingsForm({
  competitionId,
  initial,
  facts,
  mode,
  teamLabel,
  groupSuggestions,
  canAssignHosts,
  hostNames,
  hostCandidates = [],
  entrantCount,
}: {
  competitionId: string;
  initial: CompetitionSettingsValues;
  facts: CompetitionLockFacts;
  mode: "teams" | "free-for-all";
  teamLabel: string;
  groupSuggestions: string[];
  /** An Organizer: edits the Hosts. A Host sees `hostNames` read-only. */
  canAssignHosts: boolean;
  /** The Hosts' names, never an email. */
  hostNames: string[];
  /** The roster Participants an Organizer picks Hosts from; empty for a Host. */
  hostCandidates?: HostCandidate[];
  /** A Bracket's saved Entrants, for the match settings it would refuse. */
  entrantCount: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saveState, setSaveState] = useState<AutosaveSnapshot>({
    status: "idle",
    fieldErrors: {},
  });
  const [autosave] = useState(() =>
    createAutosave<CompetitionSettingsValues>({
      saved: initial,
      save: async (fields) => {
        const [field] = Object.keys(fields) as SettingsField[];
        const change = settingChangeOf(field, fields[field]!);
        if (!change.ok) {
          return {
            ok: false,
            error: change.error,
            fieldErrors: { [field]: change.error },
          };
        }
        return saveCompetitionSetting(competitionId, change.change);
      },
      // Each setting saves on its own, through the one per-field save.
      groupOf: (field) => [field],
      equals: sameSetting,
      delayMs: AUTOSAVE_DELAY_MS,
      onChange: setSaveState,
      // The locks, the run area and the header read the saved values.
      onSettled: () => router.refresh(),
    }),
  );

  // A save's refresh hands over the server's values: fields not still
  // being edited follow them; an edit in progress stays.
  const initialKey = JSON.stringify(initial);
  const [seenKey, setSeenKey] = useState(initialKey);
  if (initialKey !== seenKey) {
    setSeenKey(initialKey);
    autosave.reseed(initial);
    const kept = new Set<string>(autosave.unsavedFields());
    setValues((current) => {
      const next = { ...initial };
      for (const field of kept) {
        (next as Record<string, unknown>)[field] =
          current[field as SettingsField];
      }
      return next;
    });
  }

  const guard = useAutosaveLifecycle(autosave, saveState.fieldErrors);

  /** Sets fields and queues them to save, in the order given. */
  function edit(next: Partial<CompetitionSettingsValues>) {
    const all = { ...values, ...next };
    setValues(all);
    autosave.change(all, Object.keys(next) as SettingsField[]);
  }

  const errors = saveState.fieldErrors;
  const hostOptions = buildHostOptions(hostCandidates, values.hosts);
  const shown = new Set(shownSettings(values, mode));
  const lock = (field: SettingsField) => settingLockReason(field, facts);
  const id = (field: SettingsField) => `competition-${field}`;

  /** A field's lock reason, note and refusal, under its control. */
  const below = (field: SettingsField, help?: ReactNode) => {
    const reason = lock(field);
    const note = settingNote(field, facts);
    return (
      <>
        {reason ? (
          <FieldDescription data-slot="lock-reason">{reason}</FieldDescription>
        ) : note ? (
          <FieldDescription data-slot="setting-note">{note}</FieldDescription>
        ) : help ? (
          <FieldDescription>{help}</FieldDescription>
        ) : null}
        <FieldError>{errors[field]}</FieldError>
      </>
    );
  };

  const clockFields = (
    field: "enrollClosesAt" | "loggingClosesAt" | "checkInClosesAt",
    label: string,
    help: ReactNode,
  ) => {
    const clock: Clock = values[field];
    const off = lock(field) !== null;
    return (
      <Field data-invalid={!!errors[field]}>
        <FieldGroup className="gap-4 sm:flex-row">
          <Field className="sm:max-w-48">
            <FieldLabel htmlFor={`${id(field)}-date`}>{label}</FieldLabel>
            <DatePicker
              id={`${id(field)}-date`}
              name={`${field}Date`}
              value={clock.date}
              disabled={off}
              onValueChange={(date) => edit({ [field]: { ...clock, date } })}
            />
          </Field>
          <Field className="sm:max-w-40">
            <FieldLabel htmlFor={`${id(field)}-time`}>Time (ET)</FieldLabel>
            <TimeCombobox
              id={`${id(field)}-time`}
              name={`${field}Time`}
              value={clock.time}
              disabled={off}
              onValueChange={(time) => edit({ [field]: { ...clock, time } })}
            />
          </Field>
        </FieldGroup>
        {below(field, help)}
      </Field>
    );
  };

  const switchField = (
    field: "countsTowardTeam" | "selfReport" | "selfEnroll" | "selfCheckIn",
    label: string,
    help: ReactNode,
    extraOff = false,
  ) => {
    const off = lock(field) !== null || extraOff;
    return (
      <Field
        orientation="horizontal"
        className="max-w-xl"
        // Dims the label along with the disabled Switch.
        data-disabled={off}
        data-invalid={!!errors[field]}
      >
        <Switch
          id={id(field)}
          checked={values[field]}
          disabled={off}
          onCheckedChange={(on) => edit({ [field]: on })}
        />
        <FieldContent>
          <FieldLabel htmlFor={id(field)}>{label}</FieldLabel>
          {below(field, help)}
        </FieldContent>
      </Field>
    );
  };

  const scoringOptions = [
    // A free-for-all can still hold a team Competition (e.g. after a mode
    // change); keep its option so the select shows a label, not "team".
    ...(mode === "teams" || values.scoring === "team"
      ? [{ value: "team", label: teamLabel }]
      : []),
    { value: "individual", label: "Individual" },
  ];

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="competition-settings-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="competition-settings-heading" className="text-lg font-semibold">
          Settings
        </h2>
        <AutosaveStatusLine
          state={saveState}
          guard={guard}
          fieldLabel={(field) => FIELD_LABELS[field as SettingsField] ?? field}
        />
      </div>
      <form
        // Enter in a field saves it now instead of submitting the page.
        onSubmit={(event) => {
          event.preventDefault();
          void autosave.flush();
        }}
        className="flex flex-col gap-6"
        aria-label="Competition settings"
      >
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor={id("name")}>Name</FieldLabel>
            <Input
              id={id("name")}
              name="name"
              required
              maxLength={COMPETITION_NAME_MAX}
              className="h-11 sm:h-9"
              aria-invalid={!!errors.name}
              value={values.name}
              onChange={(event) => edit({ name: event.target.value })}
            />
            {below("name")}
          </Field>
          <Field data-invalid={!!errors.group}>
            <FieldLabel htmlFor={id("group")}>Group</FieldLabel>
            <SuggestionCombobox
              id={id("group")}
              name="group"
              maxLength={COMPETITION_GROUP_MAX}
              placeholder="Optional"
              suggestions={groupSuggestions}
              value={values.group}
              onValueChange={(group) => edit({ group })}
            />
            {below("group")}
          </Field>
          <Field className="sm:col-span-2" data-invalid={!!errors.description}>
            <FieldTitle id={`${id("description")}-label`}>
              Description
            </FieldTitle>
            <RichTextEditor
              content={values.description}
              onChange={(description) => edit({ description })}
              label="Description"
              labelId={`${id("description")}-label`}
              placeholder="Rules, links and anything players should know (optional)"
            />
            {below("description")}
          </Field>
          <Field className="sm:col-span-2" data-invalid={!!errors.format}>
            <FieldLabel htmlFor={id("format")}>Format</FieldLabel>
            <OptionSelect
              id={id("format")}
              name="format"
              options={COMPETITION_FORMATS.map((format) => ({
                value: format,
                label: formatLabel(format),
              }))}
              value={values.format}
              disabled={lock("format") !== null}
              aria-invalid={!!errors.format}
              onValueChange={(format) =>
                edit({ format: format as CompetitionSettingsValues["format"] })
              }
            />
            {below("format", FORMAT_DESCRIPTIONS[values.format])}
          </Field>
          {shown.has("scoring") && (
            <Field data-invalid={!!errors.scoring}>
              <FieldLabel htmlFor={id("scoring")}>Scoring</FieldLabel>
              <OptionSelect
                id={id("scoring")}
                name="scoring"
                options={scoringOptions}
                value={values.scoring}
                disabled={lock("scoring") !== null}
                aria-invalid={!!errors.scoring}
                onValueChange={(scoring) =>
                  edit({
                    scoring: scoring as CompetitionSettingsValues["scoring"],
                    // Team scoring already counts toward the Team.
                    ...(scoring === "team" ? { countsTowardTeam: false } : {}),
                  })
                }
              />
              {below("scoring")}
            </Field>
          )}
          {shown.has("countsTowardTeam") && (
            <div className="sm:self-end">
              {switchField(
                "countsTowardTeam",
                `Counts toward the ${teamLabel}`,
                null,
                values.scoring !== "individual",
              )}
            </div>
          )}
          {shown.has("placementPoints") && (
            <Field
              className="sm:col-span-2"
              data-invalid={!!errors.placementPoints}
            >
              <PlacementPointsRows
                value={values.placementPoints}
                invalid={!!errors.placementPoints}
                limit={placementLimit(values.format)}
                onChange={(placementPoints) => edit({ placementPoints })}
              />
              {below(
                "placementPoints",
                values.format === "participation"
                  ? `${teamLabel}s are ranked by how many of their Participants took part; ties share the higher place.`
                  : "What each place earns in the Standings.",
              )}
            </Field>
          )}
          {shown.has("participationPoints") && (
            <Field
              className="sm:max-w-48"
              data-invalid={!!errors.participationPoints}
            >
              <FieldLabel htmlFor={id("participationPoints")}>
                Points per Participant
              </FieldLabel>
              <Input
                id={id("participationPoints")}
                inputMode="decimal"
                className="h-11 sm:h-9"
                aria-invalid={!!errors.participationPoints}
                value={values.participationPoints}
                onChange={(event) =>
                  edit({ participationPoints: event.target.value })
                }
              />
              {below("participationPoints")}
            </Field>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2">
            {canAssignHosts ? (
              <>
                <Field data-invalid={!!errors.hosts}>
                  <FieldLabel htmlFor={id("hosts")}>Hosts</FieldLabel>
                  <EntityCombobox
                    multiple
                    id={id("hosts")}
                    aria-label="Hosts"
                    aria-invalid={!!errors.hosts}
                    items={hostOptions}
                    value={values.hosts}
                    onValueChange={(hosts) => edit({ hosts })}
                    placeholder="Search the roster by name"
                    emptyText="No one on the roster matches."
                  />
                  <FieldDescription>
                    A Host can change this Competition&apos;s settings, run it,
                    and its Points Entries and linked Schedule Items.
                  </FieldDescription>
                  <FieldError>{errors.hosts}</FieldError>
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel id={id("hosts")}>Hosts</FieldLabel>
                <p
                  aria-labelledby={id("hosts")}
                  className="text-sm"
                  data-slot="host-names"
                >
                  {hostNames.length > 0 ? hostNames.join(", ") : "None"}
                </p>
                <FieldDescription>
                  Only an Organizer assigns Hosts.
                </FieldDescription>
              </Field>
            )}
          </div>
        </FieldGroup>

        {shown.has("scoreDirection") && (
          <Field className="sm:max-w-xs" data-invalid={!!errors.scoreDirection}>
            <FieldLabel htmlFor={id("scoreDirection")}>
              Score direction
            </FieldLabel>
            <OptionSelect
              id={id("scoreDirection")}
              options={DIRECTION_OPTIONS}
              value={values.scoreDirection}
              disabled={lock("scoreDirection") !== null}
              aria-invalid={!!errors.scoreDirection}
              onValueChange={(value) =>
                edit({
                  scoreDirection:
                    value as CompetitionSettingsValues["scoreDirection"],
                })
              }
            />
            {below(
              "scoreDirection",
              "With a direction, Places fill from Scores as you type; you can still change any Place.",
            )}
          </Field>
        )}

        {shown.has("gameConfig") && (
          <GamesConfigFields
            values={values}
            reason={lock("gameConfig")}
            error={errors.gameConfig}
            onEdit={edit}
          />
        )}

        {shown.has("entrantsOpen") && (
          <Field className="max-w-xs" data-invalid={!!errors.entrantsOpen}>
            <FieldLabel htmlFor={id("entrantsOpen")}>Entrants</FieldLabel>
            <OptionSelect
              id={id("entrantsOpen")}
              options={[
                { value: "open", label: "Open to everyone" },
                { value: "fixed", label: "A fixed list" },
              ]}
              value={values.entrantsOpen ? "open" : "fixed"}
              disabled={
                lock("entrantsOpen") !== null || bestOfOf(values) !== null
              }
              onValueChange={(value) =>
                edit({ entrantsOpen: value === "open" })
              }
            />
            {below(
              "entrantsOpen",
              bestOfOf(values) !== null
                ? "Best of needs a fixed list of exactly two Entrants."
                : null,
            )}
          </Field>
        )}

        {shown.has("loggingClosesAt") &&
          clockFields(
            "loggingClosesAt",
            "Logging closes",
            "Participants can't log after this. Awards nothing — press Close.",
          )}

        {shown.has("bracketConfig") && (
          <MatchSettingsFields
            config={values.bracketConfig ?? DEFAULT_BRACKET_CONFIG}
            entrantCount={entrantCount}
            reason={lock("bracketConfig")}
            error={errors.bracketConfig}
            onChange={(bracketConfig) => edit({ bracketConfig })}
          />
        )}

        {shown.has("selfReport") &&
          switchField(
            "selfReport",
            "Self-report",
            "Participants in a Match can enter its result from their phone. It counts at once; you can still change any result in the Bracket below.",
          )}

        {shown.has("selfEnroll") &&
          switchField(
            "selfEnroll",
            "Participants can enroll",
            values.format === "bracket"
              ? "Participants enter themselves until the Bracket is built, the limit is reached or the close time passes."
              : `Participants enter themselves until the Entrant limit is reached, the close time passes, the first ${resultNoun(values.format as GameFormat).one} is logged, or you close this Competition.`,
          )}
        {shown.has("entrantLimit") && (
          <Field className="sm:max-w-48" data-invalid={!!errors.entrantLimit}>
            <FieldLabel htmlFor={id("entrantLimit")}>Entrant limit</FieldLabel>
            <Input
              id={id("entrantLimit")}
              type="number"
              inputMode="numeric"
              min={2}
              className="h-11 sm:h-9"
              disabled={lock("entrantLimit") !== null}
              aria-invalid={!!errors.entrantLimit}
              value={values.entrantLimit}
              onChange={(event) => edit({ entrantLimit: event.target.value })}
            />
            {below("entrantLimit")}
          </Field>
        )}
        {shown.has("enrollClosesAt") &&
          clockFields("enrollClosesAt", "Enrollment closes", null)}

        {shown.has("selfCheckIn") &&
          switchField(
            "selfCheckIn",
            "Participants can check in",
            "Participants check themselves in, or out again, from this Competition's page until the close time or until you close it. You can tick or untick anyone.",
          )}
        {shown.has("checkInClosesAt") &&
          clockFields("checkInClosesAt", "Check-in closes", null)}
      </form>
    </section>
  );
}

/** A Head-to-head Competition's Best of, or null when off or not one. */
function bestOfOf(values: CompetitionSettingsValues): BestOf | null {
  const config = values.gameConfig;
  return values.format === "head-to-head" && config && "bestOf" in config
    ? config.bestOf
    : null;
}

/**
 * Head-to-head's draws and Best of, or Best score's count, direction and
 * unit: one setting (`gameConfig`), saved whole. Turning a Best of on
 * also makes the Entrants a fixed list, saved first.
 */
function GamesConfigFields({
  values,
  reason,
  error,
  onEdit,
}: {
  values: CompetitionSettingsValues;
  reason: string | null;
  error: string | undefined;
  onEdit: (next: Partial<CompetitionSettingsValues>) => void;
}) {
  const off = reason !== null;
  if (values.format === "head-to-head") {
    // Right after a Format change the form still holds the old Format's
    // config (or none); the server saved this Format's default.
    const config: HeadToHeadConfig = gamesConfigOf({
      format: "head-to-head",
      gameConfig: values.gameConfig,
    });
    return (
      <FieldSet data-invalid={!!error}>
        <FieldLegend>Head-to-head settings</FieldLegend>
        <FieldGroup className="gap-4 sm:flex-row">
          <Field
            orientation="horizontal"
            className="sm:max-w-56"
            data-disabled={off}
          >
            <Switch
              id="competition-draws-allowed"
              checked={config.drawsAllowed}
              disabled={off}
              onCheckedChange={(drawsAllowed) =>
                onEdit({ gameConfig: { ...config, drawsAllowed } })
              }
            />
            <FieldContent>
              <FieldLabel htmlFor="competition-draws-allowed">
                Draws allowed
              </FieldLabel>
            </FieldContent>
          </Field>
          <Field className="sm:max-w-48">
            <FieldLabel htmlFor="competition-best-of">Best of</FieldLabel>
            <OptionSelect
              id="competition-best-of"
              options={BEST_OF_SELECT_OPTIONS}
              value={config.bestOf === null ? "off" : String(config.bestOf)}
              disabled={off}
              onValueChange={(value) => {
                const bestOf =
                  value === "off" ? null : (Number(value) as BestOf);
                onEdit({
                  // A Best of is played between a fixed list's two Entrants.
                  ...(bestOf !== null && values.entrantsOpen
                    ? { entrantsOpen: false }
                    : {}),
                  gameConfig: { ...config, bestOf },
                });
              }}
            />
          </Field>
        </FieldGroup>
        {reason && (
          <FieldDescription data-slot="lock-reason">{reason}</FieldDescription>
        )}
        <FieldError>{error}</FieldError>
      </FieldSet>
    );
  }
  const config: BestScoreConfig = gamesConfigOf({
    format: "best-score",
    gameConfig: values.gameConfig,
  });
  return (
    <FieldSet data-invalid={!!error}>
      <FieldLegend>Best score settings</FieldLegend>
      <FieldGroup className="gap-4 sm:flex-row">
        <Field className="sm:max-w-48">
          <FieldLabel htmlFor="competition-count">Count</FieldLabel>
          <OptionSelect
            id="competition-count"
            options={[
              { value: "best", label: "Best" },
              { value: "total", label: "Total" },
            ]}
            value={config.count}
            disabled={off}
            onValueChange={(count) =>
              onEdit({
                gameConfig: { ...config, count: count as "best" | "total" },
              })
            }
          />
        </Field>
        <Field className="sm:max-w-48">
          <FieldLabel htmlFor="competition-better-is">Better is</FieldLabel>
          <OptionSelect
            id="competition-better-is"
            options={[
              { value: "higher", label: "Higher" },
              { value: "lower", label: "Lower" },
            ]}
            value={config.betterIs}
            disabled={off}
            onValueChange={(betterIs) =>
              onEdit({
                gameConfig: {
                  ...config,
                  betterIs: betterIs as "higher" | "lower",
                },
              })
            }
          />
        </Field>
        <Field className="sm:max-w-48">
          <FieldLabel htmlFor="competition-unit">Unit</FieldLabel>
          <Input
            id="competition-unit"
            maxLength={20}
            className="h-11 sm:h-9"
            disabled={off}
            aria-invalid={!!error}
            value={config.unit}
            onChange={(event) =>
              onEdit({ gameConfig: { ...config, unit: event.target.value } })
            }
          />
        </Field>
      </FieldGroup>
      {reason && (
        <FieldDescription data-slot="lock-reason">{reason}</FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </FieldSet>
  );
}

/**
 * A Bracket's match settings: how many play in each Match and how many
 * advance (2 with 1 advancing is the "Head-to-head (single elimination)"
 * preset), and at head-to-head the 3rd place Match. With saved Entrants, a
 * "how many advance" Generate would refuse is disabled; turning the 3rd
 * place game on is disabled, with its reason, under 4 Entrants, though a
 * saved one can still be turned off. One setting (`bracketConfig`).
 */
function MatchSettingsFields({
  config,
  entrantCount,
  reason,
  error,
  onChange,
}: {
  config: BracketConfig;
  entrantCount: number;
  reason: string | null;
  error: string | undefined;
  onChange: (config: BracketConfig) => void;
}) {
  const off = reason !== null;
  const { entrantsPerHeat: perMatch, advancePerHeat: advance } = config;
  const headToHead = isHeadToHead(config);
  const turnOnRefusal = thirdPlaceRefusal(
    {
      entrantsPerHeat: perMatch,
      advancePerHeat: advance,
      thirdPlaceGame: true,
    },
    entrantCount,
  );
  const thirdPlaceReason =
    turnOnRefusal && config.thirdPlaceGame
      ? `${turnOnRefusal} Turn it off, or enter 4, to generate.`
      : turnOnRefusal;
  const refusalAt = (entrantsPerHeat: number, advancePerHeat: number) =>
    entrantCount >= 2
      ? validateConfig(
          { entrantsPerHeat, advancePerHeat, thirdPlaceGame: false },
          entrantCount,
        )
      : null;
  const refusal = refusalAt(perMatch, advance);
  const set = (next: Partial<BracketConfig>) => {
    const merged = { ...config, ...next };
    // Only head-to-head plays a 3rd place Match.
    onChange({
      ...merged,
      thirdPlaceGame: isHeadToHead(merged) && merged.thirdPlaceGame,
    });
  };

  return (
    <FieldSet data-invalid={!!error || refusal !== null}>
      <FieldLegend>Match settings</FieldLegend>
      <FieldDescription>
        Each Round deals the Entrants into Matches; the top few of each go on to
        the next Round until one Match, the Final, is left.
      </FieldDescription>
      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          variant="outline"
          size="lg"
          className="min-h-11 px-3"
          pressed={headToHead}
          disabled={off}
          onPressedChange={(pressed) => {
            // A preset: pressing sets it; pressing again leaves it.
            if (pressed) set({ entrantsPerHeat: 2, advancePerHeat: 1 });
          }}
        >
          Head-to-head (single elimination)
        </Toggle>
      </div>
      <FieldGroup className="gap-4 sm:flex-row">
        <Field className="sm:max-w-48">
          <FieldLabel htmlFor="match-entrants">Entrants per Match</FieldLabel>
          <OptionSelect
            id="match-entrants"
            name="entrantsPerHeat"
            options={ENTRANTS_PER_MATCH_OPTIONS.map((count) => ({
              value: String(count),
              label: entrantsPerMatchLabel(count),
            }))}
            value={String(perMatch)}
            disabled={off}
            onValueChange={(value) => {
              const size = Number(value);
              // The most that can advance at this size, for these Entrants.
              const best = ADVANCE_PER_MATCH_OPTIONS.filter(
                (count) => count < size && refusalAt(size, count) === null,
              ).at(-1);
              set({ entrantsPerHeat: size, advancePerHeat: best ?? 1 });
            }}
          />
        </Field>
        <Field className="sm:max-w-48" data-invalid={refusal !== null}>
          <FieldLabel htmlFor="match-advance">How many advance</FieldLabel>
          <OptionSelect
            id="match-advance"
            name="advancePerHeat"
            options={ADVANCE_PER_MATCH_OPTIONS.filter(
              (count) => count < perMatch,
            ).map((count) => {
              const why = refusalAt(perMatch, count);
              return {
                value: String(count),
                label: advancePerMatchLabel(count),
                disabled: why !== null,
                title: why ?? undefined,
              };
            })}
            value={String(advance)}
            disabled={off}
            aria-invalid={refusal !== null}
            onValueChange={(value) => set({ advancePerHeat: Number(value) })}
          />
        </Field>
      </FieldGroup>
      {refusal && <FieldDescription>{refusal}</FieldDescription>}
      {headToHead && (
        <Field
          orientation="horizontal"
          className="max-w-xl"
          data-disabled={
            off || (turnOnRefusal !== null && !config.thirdPlaceGame)
          }
        >
          <Switch
            id="bracket-third-place"
            checked={config.thirdPlaceGame}
            disabled={off || (turnOnRefusal !== null && !config.thirdPlaceGame)}
            onCheckedChange={(thirdPlaceGame) => set({ thirdPlaceGame })}
          />
          <FieldContent>
            <FieldLabel htmlFor="bracket-third-place">
              3rd place Match
            </FieldLabel>
            <FieldDescription>
              {thirdPlaceReason ??
                "The semifinal losers play for 3rd and 4th. Without it, only 1st and 2nd are placed."}
            </FieldDescription>
          </FieldContent>
        </Field>
      )}
      {reason && (
        <FieldDescription data-slot="lock-reason">{reason}</FieldDescription>
      )}
      <FieldError>{error}</FieldError>
    </FieldSet>
  );
}
