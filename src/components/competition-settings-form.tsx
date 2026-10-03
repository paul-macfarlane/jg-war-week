"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { saveCompetitionSetting } from "@/actions/setup";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  type AutosaveStatus,
  createAutosave,
  sameValue,
} from "@/lib/autosave";
import {
  ADVANCE_PER_HEAT_OPTIONS,
  type BracketConfig,
  DEFAULT_BRACKET_CONFIG,
  ENTRANTS_PER_HEAT_OPTIONS,
  advancePerHeatLabel,
  entrantsPerHeatLabel,
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
import { placementLimit } from "@/lib/competitions";
import { COMPETITION_FORMATS } from "@/lib/enums";
import {
  BEST_OF_OPTIONS,
  type BestOf,
  type BestScoreConfig,
  type HeadToHeadConfig,
  bestOfLabel,
  gamesConfigOf,
} from "@/lib/games/config";
import { type HostCandidate, buildHostOptions } from "@/lib/host-options";
import { leavingHref } from "@/lib/leave-guard";

/** How long after the last edit a change saves (as War Week settings). */
const AUTOSAVE_DELAY_MS = 800;

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: "Changes save automatically",
  saving: "Saving…",
  saved: "Saved",
  failed: "Not saved: see the field marked below",
};

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
  bracketConfig: "Heat settings",
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
 * send what's waiting; while a refusal shows, an in-app link asks first.
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
  /** A Bracket's saved Entrants, for the heat settings it would refuse. */
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

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void autosave.flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      void autosave.flush();
      if (autosave.unsaved()) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void autosave.flush();
    };
  }, [autosave]);

  const [leaving, setLeaving] = useState<string | null>(null);
  const refused = Object.entries(saveState.fieldErrors);
  const hasRefusal = refused.length > 0;
  useEffect(() => {
    if (!hasRefusal) return;
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const href = leavingHref(
        {
          href: link.href,
          target: link.target,
          download: link.hasAttribute("download"),
          button: event.button,
          modified:
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
          defaultPrevented: event.defaultPrevented,
        },
        window.location.href,
      );
      if (href === null) return;
      event.preventDefault();
      setLeaving(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [hasRefusal]);

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
        <p
          role="status"
          aria-live="polite"
          data-slot="autosave-status"
          data-status={saveState.status}
          className={
            saveState.status === "failed"
              ? "text-destructive text-sm"
              : "text-foreground/70 text-sm"
          }
        >
          {STATUS_TEXT[saveState.status]}
        </p>
      </div>
      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => {
          if (!open) setLeaving(null);
        }}
        title="Leave without saving?"
        description={
          hasRefusal
            ? `${FIELD_LABELS[refused[0][0] as SettingsField] ?? refused[0][0]} wasn't saved: ${refused[0][1]}`
            : undefined
        }
        confirmLabel="Leave"
        onConfirm={() => {
          if (leaving) router.push(leaving);
          setLeaving(null);
        }}
      />
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
              maxLength={120}
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
              maxLength={120}
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
                </Field>
                <FieldError>{errors.hosts}</FieldError>
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
          <HeatSettingsFields
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
            "Participants in a Heat can enter its result from their phone. It counts at once; you can still change any result in the Bracket below.",
          )}

        {shown.has("selfEnroll") &&
          switchField(
            "selfEnroll",
            "Participants can enroll",
            values.format === "bracket"
              ? "Participants enter themselves until the Bracket is built, the limit is reached or the close time passes."
              : "Participants enter themselves until the Entrant limit is reached, the close time passes, the first Game is logged, or you close this Competition.",
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
 * A Bracket's heat settings: how many play in each Heat and how many
 * advance (2 with 1 advancing is the "Head-to-head (single elimination)"
 * preset), and at head-to-head the 3rd place game. With saved Entrants, a
 * "how many advance" Generate would refuse is disabled; turning the 3rd
 * place game on is disabled, with its reason, under 4 Entrants, though a
 * saved one can still be turned off. One setting (`bracketConfig`).
 */
function HeatSettingsFields({
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
  const { entrantsPerHeat: perHeat, advancePerHeat: advance } = config;
  const headToHead = isHeadToHead(config);
  const turnOnRefusal = thirdPlaceRefusal(
    { entrantsPerHeat: perHeat, advancePerHeat: advance, thirdPlaceGame: true },
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
  const refusal = refusalAt(perHeat, advance);
  const set = (next: Partial<BracketConfig>) => {
    const merged = { ...config, ...next };
    // Only head-to-head plays a 3rd place game.
    onChange({
      ...merged,
      thirdPlaceGame: isHeadToHead(merged) && merged.thirdPlaceGame,
    });
  };

  return (
    <FieldSet data-invalid={!!error || refusal !== null}>
      <FieldLegend>Heat settings</FieldLegend>
      <FieldDescription>
        Each Round deals the Entrants into Heats; the top few of each go on to
        the next Round until one Heat, the Final, is left.
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
          <FieldLabel htmlFor="heat-entrants">Entrants per Heat</FieldLabel>
          <OptionSelect
            id="heat-entrants"
            name="entrantsPerHeat"
            options={ENTRANTS_PER_HEAT_OPTIONS.map((count) => ({
              value: String(count),
              label: entrantsPerHeatLabel(count),
            }))}
            value={String(perHeat)}
            disabled={off}
            onValueChange={(value) => {
              const size = Number(value);
              // The most that can advance at this size, for these Entrants.
              const best = ADVANCE_PER_HEAT_OPTIONS.filter(
                (count) => count < size && refusalAt(size, count) === null,
              ).at(-1);
              set({ entrantsPerHeat: size, advancePerHeat: best ?? 1 });
            }}
          />
        </Field>
        <Field className="sm:max-w-48" data-invalid={refusal !== null}>
          <FieldLabel htmlFor="heat-advance">How many advance</FieldLabel>
          <OptionSelect
            id="heat-advance"
            name="advancePerHeat"
            options={ADVANCE_PER_HEAT_OPTIONS.filter(
              (count) => count < perHeat,
            ).map((count) => {
              const why = refusalAt(perHeat, count);
              return {
                value: String(count),
                label: advancePerHeatLabel(count),
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
              3rd place game
            </FieldLabel>
            <FieldDescription>
              {thirdPlaceReason ??
                "The semifinal losers play for 3rd and 4th. Without it, they tie 3rd."}
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
