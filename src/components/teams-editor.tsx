"use client";

import { useId, useState } from "react";

import {
  createParticipant,
  createTeam,
  deleteParticipant,
  deleteTeam,
  updateParticipant,
  updateTeam,
} from "@/actions/setup";
import { ColorField, type ColorSwatch } from "@/components/color-field";
import { OptionSelect } from "@/components/option-select";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ParticipantInput, TeamInput } from "@/lib/setup";
import { teamSwatches } from "@/lib/theme";
import type { SetupParticipant, SetupTeam } from "@/queries/setup";

const EMPTY_TEAM: TeamInput = { name: "", color: "#888888", logoUrl: "" };

/** "2 Participants · 1 Points Entry": what deleting the Team takes with it. */
function teamUsage(team: SetupTeam): string {
  return usageSummary([
    [team.participantCount, "Participant", "Participants"],
    [team.pointsEntryCount, "Points Entry", "Points Entries"],
    [team.awardCount, "Award", "Awards"],
    [team.entrantCount, "Bracket Entrant", "Bracket Entrants"],
    [team.squadCount, "Squad", "Squads"],
  ]);
}

/**
 * One Team's name, color and logo URL, in its Sheet. With no `team` it
 * adds one. `onSaved` closes the Sheet.
 */
function TeamForm({
  warWeekId,
  team,
  teamLabel,
  swatches,
  onSaved,
}: {
  warWeekId: string;
  team?: SetupTeam;
  teamLabel: string;
  swatches: ColorSwatch[];
  onSaved: () => void;
}) {
  const initial: TeamInput = team
    ? { name: team.name, color: team.color, logoUrl: team.logoUrl ?? "" }
    : EMPTY_TEAM;
  const id = useId();
  const [values, setValues] = useState(initial);
  const { pending, formRef, formAction, fieldErrors, error, remove } =
    useSetupRow(
      () =>
        team ? updateTeam(team.id, values) : createTeam(warWeekId, values),
      `${teamLabel} saved`,
      onSaved,
    );
  const set =
    (field: keyof TeamInput) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: event.target.value }));

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={team ? `${teamLabel} ${team.name}` : `New ${teamLabel}`}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="gap-4 px-4">
        <Field data-invalid={!!fieldErrors.name}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            required
            maxLength={80}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.name}
            value={values.name}
            onChange={set("name")}
          />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.color}>
          <FieldLabel htmlFor={`${id}-color`}>Color</FieldLabel>
          <ColorField
            id={`${id}-color`}
            name="color"
            aria-invalid={!!fieldErrors.color}
            value={values.color}
            swatches={swatches}
            onValueChange={(color) => setValues((v) => ({ ...v, color }))}
          />
          <FieldError>{fieldErrors.color}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.logoUrl}>
          <FieldLabel htmlFor={`${id}-logo`}>Logo URL</FieldLabel>
          <Input
            id={`${id}-logo`}
            name="logoUrl"
            maxLength={500}
            placeholder="Optional"
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.logoUrl}
            value={values.logoUrl}
            onChange={set("logoUrl")}
          />
          <FieldError>{fieldErrors.logoUrl}</FieldError>
        </Field>
      </FieldGroup>
      <SetupSheetFooter>
        <SetupRowButtons
          pending={pending}
          addLabel={`Add ${teamLabel}`}
          rowId={team?.id}
          onDelete={
            team &&
            (() => remove(() => deleteTeam(team.id), `${teamLabel} deleted`))
          }
          deleteTitle={team && `Delete ${teamLabel} ${team.name}?`}
          deleteDescription={team && teamUsage(team)}
        />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}

const EMPTY_PARTICIPANT: ParticipantInput = {
  displayName: "",
  companyTag: "",
  email: "",
  teamId: "",
  isLeader: false,
};

/**
 * One Participant's display name, Company Tag, email, Team and Leader, in
 * their Sheet. With no `participant` it adds one. `onSaved` closes the
 * Sheet.
 */
function ParticipantForm({
  warWeekId,
  participant,
  teams,
  teamLabel,
  leaderTitle,
  tagSuggestions,
  onSaved,
}: {
  warWeekId: string;
  participant?: SetupParticipant;
  /** Empty in a free-for-all, which hides the Team and Leader fields. */
  teams: SetupTeam[];
  teamLabel: string;
  leaderTitle: string;
  /** Company Tags used in any War Week. */
  tagSuggestions: string[];
  onSaved: () => void;
}) {
  const initial: ParticipantInput = participant
    ? {
        displayName: participant.displayName,
        companyTag: participant.companyTag ?? "",
        email: participant.email ?? "",
        teamId: participant.teamId ?? "",
        isLeader: participant.isLeader,
      }
    : EMPTY_PARTICIPANT;
  const id = useId();
  const [values, setValues] = useState(initial);
  const { pending, formRef, formAction, fieldErrors, error, remove } =
    useSetupRow(
      () =>
        participant
          ? updateParticipant(participant.id, values)
          : createParticipant(warWeekId, values),
      "Participant saved",
      onSaved,
    );
  const set =
    (field: Exclude<keyof ParticipantInput, "isLeader">) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: event.target.value }));
  const teamOptions = [
    { value: "", label: `No ${teamLabel}` },
    ...teams.map((team) => ({ value: team.id, label: team.name })),
  ];

  const usage = participant
    ? usageSummary([
        [participant.pointsEntryCount, "Points Entry", "Points Entries"],
        [participant.awardCount, "Award", "Awards"],
        [participant.entrantCount, "Bracket Entrant", "Bracket Entrants"],
        [participant.squadCount, "Squad", "Squads"],
      ])
    : "";

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={participant ? participant.displayName : "New Participant"}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="gap-4 px-4">
        <Field data-invalid={!!fieldErrors.displayName}>
          <FieldLabel htmlFor={`${id}-name`}>Display name</FieldLabel>
          <Input
            id={`${id}-name`}
            name="displayName"
            required
            maxLength={120}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.displayName}
            value={values.displayName}
            onChange={set("displayName")}
          />
          <FieldError>{fieldErrors.displayName}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.companyTag}>
          <FieldLabel htmlFor={`${id}-tag`}>Company Tag</FieldLabel>
          <SuggestionCombobox
            id={`${id}-tag`}
            name="companyTag"
            maxLength={40}
            placeholder="Optional"
            suggestions={tagSuggestions}
            value={values.companyTag}
            onValueChange={(companyTag) =>
              setValues((v) => ({ ...v, companyTag }))
            }
          />
          <FieldError>{fieldErrors.companyTag}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.email}>
          <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            maxLength={254}
            placeholder="Optional"
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.email}
            value={values.email}
            onChange={set("email")}
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </Field>
        {teams.length > 0 && (
          <>
            <Field data-invalid={!!fieldErrors.teamId}>
              <FieldLabel htmlFor={`${id}-team`}>{teamLabel}</FieldLabel>
              <OptionSelect
                id={`${id}-team`}
                name="teamId"
                aria-invalid={!!fieldErrors.teamId}
                options={teamOptions}
                value={values.teamId}
                onValueChange={(teamId) => setValues((v) => ({ ...v, teamId }))}
              />
              <FieldError>{fieldErrors.teamId}</FieldError>
            </Field>
            <Field orientation="horizontal" className="min-h-11 sm:min-h-9">
              <Switch
                id={`${id}-leader`}
                name="isLeader"
                checked={values.isLeader}
                onCheckedChange={(isLeader) =>
                  setValues((v) => ({ ...v, isLeader }))
                }
              />
              <FieldLabel htmlFor={`${id}-leader`}>{leaderTitle}</FieldLabel>
            </Field>
          </>
        )}
        {participant &&
          (participant.pointsEntryCount > 0 ||
            participant.awardCount > 0 ||
            participant.entrantCount > 0 ||
            participant.squadCount > 0) && (
            <p className="text-foreground/60 text-xs">{usage}</p>
          )}
      </FieldGroup>
      <SetupSheetFooter>
        <SetupRowButtons
          pending={pending}
          addLabel="Add Participant"
          rowId={participant?.id}
          onDelete={
            participant &&
            (() =>
              remove(
                () => deleteParticipant(participant.id),
                "Participant deleted",
              ))
          }
          deleteTitle={participant && `Delete ${participant.displayName}?`}
          deleteDescription={usage}
        />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}

/** The War Week's Teams, each opening in a Sheet, plus an Add button. */
export function TeamsEditor({
  warWeekId,
  teams,
  teamLabel,
  themeSwatches,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  teams: SetupTeam[];
  teamLabel: string;
  /** The Appearance Theme's colors, offered as Team color swatches. */
  themeSwatches: ColorSwatch[];
}) {
  // Each form offers the theme colors plus the other Teams' colors.
  const swatchesFor = (teamId?: string) => [
    ...themeSwatches,
    ...teamSwatches(teams, teamId),
  ];
  const formProps = { warWeekId, teamLabel };
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {teams.length === 0 ? (
        <p className="text-foreground/70 text-sm">No {teamLabel}s yet.</p>
      ) : (
        <ul aria-label={`${teamLabel}s`}>
          {teams.map((team) => (
            <SetupListRow
              key={team.id}
              id={team.id}
              name={team.name}
              label={`${teamLabel} ${team.name}`}
              details={teamUsage(team)}
              leading={
                <span
                  aria-hidden
                  className="border-border size-3 shrink-0 rounded-full border"
                  style={{ backgroundColor: team.color }}
                />
              }
              form={(close) => (
                <TeamForm
                  {...formProps}
                  team={team}
                  swatches={swatchesFor(team.id)}
                  onSaved={close}
                />
              )}
            />
          ))}
        </ul>
      )}
      <SetupAddButton
        label={`Add ${teamLabel}`}
        form={(close) => (
          <TeamForm {...formProps} swatches={swatchesFor()} onSaved={close} />
        )}
      />
    </div>
  );
}

/** The roster: every Participant, each opening in a Sheet, then "Add Participant". */
export function RosterEditor({
  warWeekId,
  participants,
  teams,
  teamLabel,
  leaderTitle,
  tagSuggestions,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  participants: SetupParticipant[];
  teams: SetupTeam[];
  teamLabel: string;
  leaderTitle: string;
  /** Company Tags used in any War Week, for the Company Tag field. */
  tagSuggestions: string[];
}) {
  const formProps = {
    warWeekId,
    teams,
    teamLabel,
    leaderTitle,
    tagSuggestions,
  };
  const teamName = new Map(teams.map((team) => [team.id, team.name]));
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {participants.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Participants yet.</p>
      ) : (
        <ul aria-label="Roster">
          {participants.map((p) => (
            <SetupListRow
              key={p.id}
              id={p.id}
              name={p.displayName}
              details={[
                p.companyTag,
                p.teamId && teamName.get(p.teamId),
                teams.length > 0 && p.isLeader && leaderTitle,
              ]
                .filter(Boolean)
                .join(" · ")}
              note={
                p.email?.trim()
                  ? undefined
                  : "No email: won't be linked when they sign in"
              }
              form={(close) => (
                <ParticipantForm
                  {...formProps}
                  participant={p}
                  onSaved={close}
                />
              )}
            />
          ))}
        </ul>
      )}
      <SetupAddButton
        label="Add Participant"
        form={(close) => <ParticipantForm {...formProps} onSaved={close} />}
      />
    </div>
  );
}
