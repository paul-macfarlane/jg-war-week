"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  createCompetition,
  deleteCompetition,
  setCompetitionHosts,
  updateCompetition,
} from "@/actions/setup";
import { JgEmailChips } from "@/components/jg-email-chips";
import { OptionSelect } from "@/components/option-select";
import { PlacementPointsRows } from "@/components/placement-points-rows";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
  SetupRowButtons,
  SetupRowError,
  SetupSheetFooter,
  usageSummary,
  useSetupRow,
} from "@/components/setup-row";
import { SuggestionCombobox } from "@/components/suggestion-combobox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WarWeek } from "@/db/schema";
import { type Format, formatLabel, isBracketFormat } from "@/lib/bracket/view";
import { COMPETITION_FORMATS, GAME_TYPES, type GameType } from "@/lib/enums";
import { gameTypeLabel } from "@/lib/games/config";
import type { CompetitionInput } from "@/lib/setup";
import type { SetupCompetition } from "@/queries/setup";

/** How each Format runs a Competition, shown on the create form. */
const FORMAT_DESCRIPTIONS: Record<Format, string> = {
  points: "Only Points Entries; no Bracket.",
  "single-elimination": "A knockout Bracket: one loss and an Entrant is out.",
  heats:
    "A Bracket where Entrants play in Heats; a set number advance each Round.",
  games:
    "Players log Games themselves and a leaderboard ranks them. Chosen only here: a Games Competition keeps its Format.",
};

/** How each Game Type decides a Game, shown when Games is chosen. */
const GAME_TYPE_DESCRIPTIONS: Record<GameType, string> = {
  "head-to-head": "Two players; a winner, or a draw when allowed.",
  "best-score": "Each Game records a score; the best or the total counts.",
  ranked: "Each Game records a finishing order, worth Finish Points.",
};

/** Where a saved Competition of this Format is set up, or null for points. */
function setupHref(competition: Pick<SetupCompetition, "id" | "format">) {
  return competition.format === "games"
    ? `/admin/setup/competitions/${competition.id}/games`
    : `/admin/setup/competitions/${competition.id}/bracket`;
}

function emptyCompetition(mode: WarWeek["mode"]): CompetitionInput {
  return {
    name: "",
    description: "",
    scoring: mode === "free-for-all" ? "individual" : "team",
    maxPoints: "",
    placementPoints: "",
    countsTowardTeam: false,
    group: "",
    format: "points",
    gameType: "head-to-head",
  };
}

function inputFrom(competition: SetupCompetition): CompetitionInput {
  return {
    name: competition.name,
    description: competition.description ?? "",
    scoring: competition.scoring,
    maxPoints: competition.maxPoints?.toString() ?? "",
    placementPoints: competition.placementPoints?.join(", ") ?? "",
    countsTowardTeam: competition.countsTowardTeam,
    group: competition.competitionGroup ?? "",
  };
}

/**
 * A Competition's Hosts, for Organizers. The Sheet's Save assigns them,
 * through their own "assign Hosts" action, when they changed.
 */
function HostsField({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <JgEmailChips
        label="Hosts"
        description="A Host can change this Competition's setup, Bracket, Points Entries and linked Schedule Items."
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

/** "3 Points Entries · 1 Schedule Item": what goes with the Competition. */
function competitionUsage(competition: SetupCompetition): string {
  return usageSummary([
    [competition.pointsEntryCount, "Points Entry", "Points Entries"],
    [competition.scheduleItemCount, "Schedule Item", "Schedule Items"],
  ]);
}

/**
 * One Competition's fields, saved on its own, in its Sheet. With no
 * `competition` it adds one. Save also assigns the Hosts (Organizers only)
 * when they changed. `onSaved` closes the Sheet.
 */
function CompetitionForm({
  warWeekId,
  competition,
  canDelete,
  hosts,
  mode,
  teamLabel,
  groupSuggestions,
  onSaved,
}: {
  warWeekId: string;
  competition?: SetupCompetition;
  /** Deleting a Competition is Organizer-only. */
  canDelete: boolean;
  /** The Competition's Hosts, shown only to Organizers. */
  hosts?: string[];
  mode: WarWeek["mode"];
  teamLabel: string;
  groupSuggestions: string[];
  onSaved: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState(
    competition ? inputFrom(competition) : emptyCompetition(mode),
  );
  const [hostEmails, setHostEmails] = useState(hosts ?? []);
  const hostsChanged =
    hosts !== undefined && hostEmails.join("\n") !== hosts.join("\n");
  const { pending, formRef, formAction, fieldErrors, error, remove } =
    useSetupRow(
      async () => {
        // Only an individual Competition can count toward the Team.
        const input = {
          ...values,
          countsTowardTeam:
            values.scoring === "individual" && values.countsTowardTeam,
        };
        if (competition) {
          const saved = await updateCompetition(competition.id, input);
          // Hosts go only once the setup saved, so a refusal can't half-save.
          if (!saved.ok || !hostsChanged) return saved;
          return setCompetitionHosts(competition.id, hostEmails);
        }
        const result = await createCompetition(warWeekId, input);
        // A Bracket or Games Format links straight to its setup.
        if (
          result.ok &&
          (isBracketFormat(input.format) || input.format === "games")
        ) {
          router.push(
            setupHref({ id: result.id, format: input.format as Format }),
          );
        }
        return result;
      },
      "Competition saved",
      onSaved,
    );
  const set =
    (field: Exclude<keyof CompetitionInput, "countsTowardTeam">) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: event.target.value }));
  const scoringOptions = [
    // A free-for-all can still hold a team Competition (e.g. after a mode
    // change); keep its option so the select shows a label, not "team".
    ...(mode === "teams" || values.scoring === "team"
      ? [{ value: "team", label: teamLabel }]
      : []),
    { value: "individual", label: "Individual" },
  ];

  const usage = competition ? competitionUsage(competition) : "";

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={competition ? competition.name : "New Competition"}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="grid gap-3 px-4 sm:grid-cols-2">
        <Field data-invalid={!!fieldErrors.name}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            required
            maxLength={120}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.name}
            value={values.name}
            onChange={set("name")}
          />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.group}>
          <FieldLabel htmlFor={`${id}-group`}>Group</FieldLabel>
          <SuggestionCombobox
            id={`${id}-group`}
            name="group"
            maxLength={120}
            placeholder="Optional"
            suggestions={groupSuggestions}
            value={values.group}
            onValueChange={(group) => setValues((v) => ({ ...v, group }))}
          />
          <FieldError>{fieldErrors.group}</FieldError>
        </Field>
        <Field
          className="sm:col-span-2"
          data-invalid={!!fieldErrors.description}
        >
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          <Textarea
            id={`${id}-description`}
            name="description"
            maxLength={2000}
            rows={2}
            placeholder="Optional"
            aria-invalid={!!fieldErrors.description}
            value={values.description}
            onChange={set("description")}
          />
          <FieldError>{fieldErrors.description}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.scoring}>
          <FieldLabel htmlFor={`${id}-scoring`}>Scoring</FieldLabel>
          <OptionSelect
            id={`${id}-scoring`}
            name="scoring"
            aria-invalid={!!fieldErrors.scoring}
            options={scoringOptions}
            value={values.scoring}
            onValueChange={(scoring) => setValues((v) => ({ ...v, scoring }))}
          />
          <FieldError>{fieldErrors.scoring}</FieldError>
        </Field>
        {mode === "teams" && (
          <Field
            orientation="horizontal"
            // Dims the label along with the disabled Switch.
            data-disabled={values.scoring !== "individual"}
            className="min-h-11 sm:min-h-9 sm:self-end"
          >
            <Switch
              id={`${id}-counts`}
              name="countsTowardTeam"
              disabled={values.scoring !== "individual"}
              checked={
                values.scoring === "individual" && values.countsTowardTeam
              }
              onCheckedChange={(countsTowardTeam) =>
                setValues((v) => ({ ...v, countsTowardTeam }))
              }
            />
            <FieldLabel htmlFor={`${id}-counts`}>
              Counts toward the {teamLabel}
            </FieldLabel>
          </Field>
        )}
        {!competition && (
          <Field className="sm:col-span-2" data-invalid={!!fieldErrors.format}>
            <FieldLabel htmlFor={`${id}-format`}>Format</FieldLabel>
            <OptionSelect
              id={`${id}-format`}
              name="format"
              options={COMPETITION_FORMATS.map((format) => ({
                value: format,
                label: formatLabel(format),
              }))}
              value={values.format ?? "points"}
              onValueChange={(format) => setValues((v) => ({ ...v, format }))}
            />
            <FieldDescription>
              {COMPETITION_FORMATS.map((format) => (
                <span key={format} className="block">
                  <strong>{formatLabel(format)}:</strong>{" "}
                  {FORMAT_DESCRIPTIONS[format]}
                </span>
              ))}
            </FieldDescription>
            <FieldError>{fieldErrors.format}</FieldError>
          </Field>
        )}
        {!competition && values.format === "games" && (
          <Field
            className="sm:col-span-2"
            data-invalid={!!fieldErrors.gameType}
          >
            <FieldLabel htmlFor={`${id}-game-type`}>Game Type</FieldLabel>
            <OptionSelect
              id={`${id}-game-type`}
              name="gameType"
              aria-invalid={!!fieldErrors.gameType}
              options={GAME_TYPES.map((gameType) => ({
                value: gameType,
                label: gameTypeLabel(gameType),
              }))}
              value={values.gameType ?? "head-to-head"}
              onValueChange={(gameType) =>
                setValues((v) => ({ ...v, gameType }))
              }
            />
            <FieldDescription>
              {GAME_TYPES.map((gameType) => (
                <span key={gameType} className="block">
                  <strong>{gameTypeLabel(gameType)}:</strong>{" "}
                  {GAME_TYPE_DESCRIPTIONS[gameType]}
                </span>
              ))}
            </FieldDescription>
            <FieldError>{fieldErrors.gameType}</FieldError>
          </Field>
        )}
        <Field
          className="sm:col-start-1"
          data-invalid={!!fieldErrors.maxPoints}
        >
          <FieldLabel htmlFor={`${id}-max`}>Max points</FieldLabel>
          <Input
            id={`${id}-max`}
            name="maxPoints"
            inputMode="decimal"
            placeholder="Optional"
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.maxPoints}
            value={values.maxPoints}
            onChange={set("maxPoints")}
          />
          <FieldDescription>
            Optional. The most points 1st place&rsquo;s Placement Points can be
            worth. A single Points Entry over it still saves, with a warning.
          </FieldDescription>
          <FieldError>{fieldErrors.maxPoints}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.placementPoints}>
          <PlacementPointsRows
            value={values.placementPoints}
            maxPoints={values.maxPoints}
            invalid={!!fieldErrors.placementPoints}
            onChange={(placementPoints) =>
              setValues((v) => ({ ...v, placementPoints }))
            }
          />
          <FieldError>{fieldErrors.placementPoints}</FieldError>
        </Field>
        {competition && hosts && (
          <HostsField
            value={hostEmails}
            onChange={setHostEmails}
            disabled={pending}
          />
        )}
      </FieldGroup>
      <SetupSheetFooter>
        <SetupRowButtons
          pending={pending}
          addLabel="Add Competition"
          rowId={competition?.id}
          onDelete={
            competition && canDelete
              ? () =>
                  remove(
                    () => deleteCompetition(competition.id),
                    "Competition deleted",
                  )
              : undefined
          }
          deleteTitle={competition && `Delete ${competition.name}?`}
          deleteDescription={usage}
        />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}

/** The War Week's Competitions by name, each opening in a Sheet, plus an Add button. */
export function CompetitionsEditor({
  warWeekId,
  isOrganizer,
  hosts,
  competitions,
  mode,
  teamLabel,
  groupSuggestions,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Organizers add, delete and assign Hosts; a Host only edits setup. */
  isOrganizer: boolean;
  /** Each Competition's Hosts by Competition id (Organizers only). */
  hosts?: Record<string, string[]>;
  competitions: SetupCompetition[];
  mode: WarWeek["mode"];
  teamLabel: string;
  /** Competition Groups already used in this War Week. */
  groupSuggestions: string[];
}) {
  const formProps = { warWeekId, mode, teamLabel, groupSuggestions };
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {competitions.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Competitions yet.</p>
      ) : (
        <ul aria-label="Competitions">
          {competitions.map((c) => {
            const competitionHosts = isOrganizer
              ? (hosts?.[c.id] ?? [])
              : undefined;
            return (
              <SetupListRow
                key={c.id}
                id={c.id}
                name={c.name}
                details={[
                  c.competitionGroup,
                  c.scoring === "team" ? teamLabel : "Individual",
                  formatLabel(c.format),
                  competitionHosts?.length &&
                    `Hosts: ${competitionHosts.join(", ")}`,
                  competitionUsage(c),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                aside={
                  <Link
                    href={setupHref(c)}
                    className="text-primary inline-flex min-h-11 shrink-0 items-center px-2 text-sm underline-offset-4 hover:underline sm:min-h-0"
                  >
                    {c.format === "points"
                      ? "Run as a Bracket"
                      : c.format === "games"
                        ? "Games"
                        : "Bracket"}
                  </Link>
                }
                form={(close) => (
                  <CompetitionForm
                    {...formProps}
                    competition={c}
                    canDelete={isOrganizer}
                    hosts={competitionHosts}
                    onSaved={close}
                  />
                )}
              />
            );
          })}
        </ul>
      )}
      {isOrganizer && (
        <SetupAddButton
          label="Add Competition"
          form={(close) => (
            <CompetitionForm {...formProps} canDelete onSaved={close} />
          )}
        />
      )}
    </div>
  );
}
