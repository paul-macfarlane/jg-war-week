"use client";

import Link from "next/link";
import { useId, useState } from "react";

import {
  createCompetition,
  deleteCompetition,
  updateCompetition,
} from "@/actions/setup";
import { OptionSelect } from "@/components/option-select";
import { PlacementPointsRows } from "@/components/placement-points-rows";
import {
  SETUP_EDITOR,
  SetupRowButtons,
  SetupRowError,
  setupRowProps,
  usageSummary,
  useSetupRow,
} from "@/components/setup-row";
import { SuggestionCombobox } from "@/components/suggestion-combobox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WarWeek } from "@/db/schema";
import { formatLabel } from "@/lib/bracket/view";
import type { CompetitionInput } from "@/lib/setup";
import type { SetupCompetition } from "@/queries/setup";

function emptyCompetition(mode: WarWeek["mode"]): CompetitionInput {
  return {
    name: "",
    description: "",
    scoring: mode === "free-for-all" ? "individual" : "team",
    maxPoints: "",
    placementPoints: "",
    countsTowardTeam: false,
    group: "",
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

/** One Competition's fields, saved on its own. With no `competition` it adds. */
function CompetitionRow({
  competition,
  mode,
  teamLabel,
  groupSuggestions,
}: {
  competition?: SetupCompetition;
  mode: WarWeek["mode"];
  teamLabel: string;
  groupSuggestions: string[];
}) {
  const id = useId();
  const [values, setValues] = useState(
    competition ? inputFrom(competition) : emptyCompetition(mode),
  );
  const { pending, run, error } = useSetupRow(
    competition ? undefined : () => setValues(emptyCompetition(mode)),
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

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only an individual Competition can count toward the Team.
    const input = {
      ...values,
      countsTowardTeam:
        values.scoring === "individual" && values.countsTowardTeam,
    };
    run(
      () =>
        competition
          ? updateCompetition(competition.id, input)
          : createCompetition(input),
      "Competition saved",
    );
  }

  const usage = competition
    ? usageSummary([
        [competition.pointsEntryCount, "Points Entry", "Points Entries"],
        [competition.scheduleItemCount, "Schedule Item", "Schedule Items"],
      ])
    : "";

  return (
    <li
      {...setupRowProps(competition?.id)}
      className="border-border border-b py-4 last:border-b-0"
    >
      <form
        onSubmit={submit}
        aria-label={competition ? competition.name : "New Competition"}
      >
        <FieldGroup className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              required
              maxLength={120}
              className="h-11 sm:h-9"
              value={values.name}
              onChange={set("name")}
            />
          </Field>
          <Field>
            {/* SuggestionCombobox takes no id, so the label wraps it. */}
            <FieldLabel className="w-full flex-col items-stretch">
              Group
              <SuggestionCombobox
                name="group"
                maxLength={120}
                placeholder="Optional"
                suggestions={groupSuggestions}
                value={values.group}
                onValueChange={(group) => setValues((v) => ({ ...v, group }))}
              />
            </FieldLabel>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
            <Textarea
              id={`${id}-description`}
              name="description"
              maxLength={2000}
              rows={2}
              placeholder="Optional"
              value={values.description}
              onChange={set("description")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-scoring`}>Scoring</FieldLabel>
            <OptionSelect
              id={`${id}-scoring`}
              name="scoring"
              options={scoringOptions}
              value={values.scoring}
              onValueChange={(scoring) => setValues((v) => ({ ...v, scoring }))}
            />
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
          <Field className="sm:col-start-1">
            <FieldLabel htmlFor={`${id}-max`}>Max points</FieldLabel>
            <Input
              id={`${id}-max`}
              name="maxPoints"
              inputMode="decimal"
              placeholder="Optional"
              className="h-11 sm:h-9"
              value={values.maxPoints}
              onChange={set("maxPoints")}
            />
          </Field>
          <PlacementPointsRows
            value={values.placementPoints}
            maxPoints={values.maxPoints}
            onChange={(placementPoints) =>
              setValues((v) => ({ ...v, placementPoints }))
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
            <div className="flex flex-col gap-1">
              {competition && (
                <p className="text-sm">
                  Format: {formatLabel(competition.format)} ·{" "}
                  <Link
                    href={`/admin/setup/competitions/${competition.id}/bracket`}
                    className="text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-0"
                  >
                    {competition.format === "points"
                      ? "Run as a Bracket"
                      : "Bracket"}
                  </Link>
                </p>
              )}
              <p className="text-foreground/60 text-xs">{usage}</p>
            </div>
            <SetupRowButtons
              pending={pending}
              addLabel="Add Competition"
              onDelete={
                competition &&
                (() =>
                  run(
                    () => deleteCompetition(competition.id),
                    "Competition deleted",
                  ))
              }
              deleteTitle={competition && `Delete ${competition.name}?`}
              deleteDescription={usage}
            />
          </div>
        </FieldGroup>
      </form>
      <SetupRowError error={error} />
    </li>
  );
}

/** The War Week's Competitions by name, each editable, plus an add form. */
export function CompetitionsEditor({
  competitions,
  mode,
  teamLabel,
  groupSuggestions,
}: {
  competitions: SetupCompetition[];
  mode: WarWeek["mode"];
  teamLabel: string;
  /** Competition Groups already used in this War Week. */
  groupSuggestions: string[];
}) {
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-6">
      {competitions.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Competitions yet.</p>
      ) : (
        <ul aria-label="Competitions">
          {competitions.map((c) => (
            // Keyed on the saved values so a refresh resets the row's fields.
            <CompetitionRow
              key={`${c.id}-${JSON.stringify(inputFrom(c))}`}
              competition={c}
              mode={mode}
              teamLabel={teamLabel}
              groupSuggestions={groupSuggestions}
            />
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Add a Competition</h2>
        <ul>
          <CompetitionRow
            mode={mode}
            teamLabel={teamLabel}
            groupSuggestions={groupSuggestions}
          />
        </ul>
      </section>
    </div>
  );
}
