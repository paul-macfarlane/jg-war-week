"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { createCompetition, deleteCompetition } from "@/actions/setup";
import { OptionSelect } from "@/components/option-select";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
  usageSummary,
  useSetupRow,
} from "@/components/setup-row";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { WarWeek } from "@/db/schema";
import { type Format, formatLabel } from "@/lib/bracket/view";
import { FORMAT_DESCRIPTIONS } from "@/lib/competition-page";
import { competitionPageHref } from "@/lib/competitions";
import { COMPETITION_FORMATS } from "@/lib/enums";
import type { CompetitionInput } from "@/lib/setup";
import type { SetupCompetition } from "@/queries/setup";

function emptyCompetition(mode: WarWeek["mode"]): CompetitionInput {
  return {
    name: "",
    description: "",
    scoring: mode === "free-for-all" ? "individual" : "team",
    placementPoints: "",
    countsTowardTeam: false,
    group: "",
    format: "placement",
  };
}

/** "3 Points Entries · 1 Schedule Item": what goes with the Competition. */
function competitionUsage(competition: SetupCompetition): string {
  return usageSummary([
    [competition.pointsEntryCount, "Points Entry", "Points Entries"],
    [competition.scheduleItemCount, "Schedule Item", "Schedule Items"],
  ]);
}

/**
 * A new Competition, in a Sheet: its name, Format and scoring. Once added,
 * it opens the Competition's page for everything else.
 */
function NewCompetitionForm({
  warWeekId,
  mode,
  teamLabel,
  onSaved,
}: {
  warWeekId: string;
  mode: WarWeek["mode"];
  teamLabel: string;
  onSaved: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState(emptyCompetition(mode));
  const { formRef, formAction, fieldErrors, error, pending } = useSetupRow(
    async () => {
      const result = await createCompetition(warWeekId, values);
      if (result.ok) router.push(competitionPageHref(result.id));
      return result;
    },
    "Competition added",
    onSaved,
  );
  const scoringOptions = [
    ...(mode === "teams" ? [{ value: "team", label: teamLabel }] : []),
    { value: "individual", label: "Individual" },
  ];
  const format = (values.format ?? "placement") as Format;

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label="New Competition"
      className="flex flex-col gap-4"
    >
      <FieldGroup className="grid gap-3 px-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" data-invalid={!!fieldErrors.name}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            required
            maxLength={120}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.name}
            value={values.name}
            onChange={(event) =>
              setValues((v) => ({ ...v, name: event.target.value }))
            }
          />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.format}>
          <FieldLabel htmlFor={`${id}-format`}>Format</FieldLabel>
          <OptionSelect
            id={`${id}-format`}
            name="format"
            options={COMPETITION_FORMATS.map((option) => ({
              value: option,
              label: formatLabel(option),
            }))}
            value={format}
            onValueChange={(next) => setValues((v) => ({ ...v, format: next }))}
          />
          <FieldDescription>{FORMAT_DESCRIPTIONS[format]}</FieldDescription>
          <FieldError>{fieldErrors.format}</FieldError>
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
      </FieldGroup>
      <SetupSheetFooter>
        <SetupSaveButton pending={pending} label="Add Competition" />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}

/**
 * The War Week's Competitions by name, each with Edit (its Competition
 * page) and Delete, plus Add (a Sheet that then opens the new page).
 */
export function CompetitionsEditor({
  warWeekId,
  isOrganizer,
  hosts,
  hostNames,
  competitions,
  mode,
  teamLabel,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Organizers add and delete; a Host only opens their Competitions. */
  isOrganizer: boolean;
  /** Each Competition's Hosts by Competition id (Organizers only). */
  hosts?: Record<string, string[]>;
  /** Each Host email's shown name (Profile name, else the email). */
  hostNames?: Record<string, string>;
  competitions: SetupCompetition[];
  mode: WarWeek["mode"];
  teamLabel: string;
}) {
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
                    `Hosts: ${competitionHosts.map((h) => hostNames?.[h] ?? h).join(", ")}`,
                  competitionUsage(c),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                editHref={competitionPageHref(c.id)}
                // Deleting a Competition is Organizer-only.
                onDelete={
                  isOrganizer ? () => deleteCompetition(c.id) : undefined
                }
                deleteTitle={`Delete ${c.name}?`}
                deleteDescription={competitionUsage(c)}
                deleteSuccess="Competition deleted"
              />
            );
          })}
        </ul>
      )}
      {isOrganizer && (
        <SetupAddButton
          label="Add Competition"
          form={(close) => (
            <NewCompetitionForm
              warWeekId={warWeekId}
              mode={mode}
              teamLabel={teamLabel}
              onSaved={close}
            />
          )}
        />
      )}
    </div>
  );
}
