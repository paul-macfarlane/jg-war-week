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
import { normalizeHex } from "@/lib/color";
import type { ParticipantInput, TeamInput } from "@/lib/setup";
import type { SetupParticipant, SetupTeam } from "@/queries/setup";

const EMPTY_TEAM: TeamInput = { name: "", color: "#888888", logoUrl: "" };

/** One Team's name, color and logo URL. With no `team` it's the add row. */
function TeamRow({
  warWeekId,
  team,
  teamLabel,
  swatches,
}: {
  warWeekId: string;
  team?: SetupTeam;
  teamLabel: string;
  swatches: ColorSwatch[];
}) {
  const initial: TeamInput = team
    ? { name: team.name, color: team.color, logoUrl: team.logoUrl ?? "" }
    : EMPTY_TEAM;
  const id = useId();
  const [values, setValues] = useState(initial);
  const { pending, run, error } = useSetupRow(
    team ? undefined : () => setValues(EMPTY_TEAM),
  );
  const set =
    (field: keyof TeamInput) => (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: event.target.value }));

  const usage = team
    ? usageSummary([
        [team.participantCount, "Participant", "Participants"],
        [team.pointsEntryCount, "Points Entry", "Points Entries"],
        [team.awardCount, "Award", "Awards"],
        [team.entrantCount, "Bracket Entrant", "Bracket Entrants"],
      ])
    : "";

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () =>
        team ? updateTeam(team.id, values) : createTeam(warWeekId, values),
      `${teamLabel} saved`,
    );
  }

  return (
    <li
      {...setupRowProps(team?.id)}
      className="border-border border-b py-3 last:border-b-0"
    >
      <form
        onSubmit={submit}
        aria-label={team ? `${teamLabel} ${team.name}` : `New ${teamLabel}`}
      >
        <FieldGroup className="gap-2 sm:flex-row sm:items-end">
          <Field className="min-w-0 sm:flex-1">
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              required
              maxLength={80}
              className="h-11 sm:h-9"
              value={values.name}
              onChange={set("name")}
            />
          </Field>
          <Field className="sm:w-auto">
            <FieldLabel htmlFor={`${id}-color`}>Color</FieldLabel>
            <ColorField
              id={`${id}-color`}
              name="color"
              value={values.color}
              swatches={swatches}
              onValueChange={(color) => setValues((v) => ({ ...v, color }))}
            />
          </Field>
          <Field className="sm:flex-1">
            <FieldLabel htmlFor={`${id}-logo`}>Logo URL</FieldLabel>
            <Input
              id={`${id}-logo`}
              name="logoUrl"
              maxLength={500}
              placeholder="Optional"
              className="h-11 sm:h-9"
              value={values.logoUrl}
              onChange={set("logoUrl")}
            />
          </Field>
          <SetupRowButtons
            pending={pending}
            addLabel={`Add ${teamLabel}`}
            onDelete={
              team &&
              (() => run(() => deleteTeam(team.id), `${teamLabel} deleted`))
            }
            deleteTitle={team && `Delete ${teamLabel} ${team.name}?`}
            deleteDescription={usage}
          />
        </FieldGroup>
      </form>
      {team && <p className="text-foreground/60 mt-1 text-xs">{usage}</p>}
      <SetupRowError error={error} />
    </li>
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
 * One roster row: display name, Company Tag, email, Team and Leader. With
 * no `participant` it's the inline "Add Participant" row.
 */
function ParticipantRow({
  warWeekId,
  participant,
  teams,
  teamLabel,
  leaderTitle,
  tagSuggestions,
}: {
  warWeekId: string;
  participant?: SetupParticipant;
  /** Empty in a free-for-all, which hides the Team and Leader fields. */
  teams: SetupTeam[];
  teamLabel: string;
  leaderTitle: string;
  /** Company Tags used in any War Week. */
  tagSuggestions: string[];
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
  const { pending, run, error } = useSetupRow(
    participant ? undefined : () => setValues(EMPTY_PARTICIPANT),
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
      ])
    : "";

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      () =>
        participant
          ? updateParticipant(participant.id, values)
          : createParticipant(warWeekId, values),
      "Participant saved",
    );
  }

  return (
    <li
      {...setupRowProps(participant?.id)}
      className="border-border border-b py-3 last:border-b-0"
    >
      <form
        onSubmit={submit}
        aria-label={participant ? participant.displayName : "New Participant"}
      >
        <FieldGroup className="grid gap-2 sm:grid-cols-3 sm:items-end xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Display name</FieldLabel>
            <Input
              id={`${id}-name`}
              name="displayName"
              required
              maxLength={120}
              className="h-11 sm:h-9"
              value={values.displayName}
              onChange={set("displayName")}
            />
          </Field>
          <Field>
            {/* SuggestionCombobox takes no id, so the label wraps it. */}
            <FieldLabel className="w-full flex-col items-stretch">
              Company Tag
              <SuggestionCombobox
                name="companyTag"
                maxLength={40}
                placeholder="Optional"
                suggestions={tagSuggestions}
                value={values.companyTag}
                onValueChange={(companyTag) =>
                  setValues((v) => ({ ...v, companyTag }))
                }
              />
            </FieldLabel>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              maxLength={254}
              placeholder="Optional"
              className="h-11 sm:h-9"
              value={values.email}
              onChange={set("email")}
            />
          </Field>
          {teams.length > 0 ? (
            <>
              <Field>
                <FieldLabel htmlFor={`${id}-team`}>{teamLabel}</FieldLabel>
                <OptionSelect
                  id={`${id}-team`}
                  name="teamId"
                  options={teamOptions}
                  value={values.teamId}
                  onValueChange={(teamId) =>
                    setValues((v) => ({ ...v, teamId }))
                  }
                />
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
          ) : (
            <span className="hidden sm:col-span-2 sm:block" />
          )}
          <SetupRowButtons
            pending={pending}
            addLabel="Add Participant"
            onDelete={
              participant &&
              (() =>
                run(
                  () => deleteParticipant(participant.id),
                  "Participant deleted",
                ))
            }
            deleteTitle={participant && `Delete ${participant.displayName}?`}
            deleteDescription={usage}
          />
        </FieldGroup>
      </form>
      {participant &&
        (participant.pointsEntryCount > 0 ||
          participant.awardCount > 0 ||
          participant.entrantCount > 0) && (
          <p className="text-foreground/60 mt-1 text-xs">{usage}</p>
        )}
      <SetupRowError error={error} />
    </li>
  );
}

/** The War Week's Teams, each editable, plus an add row. */
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
  // Each row offers the theme colors plus the other Teams' colors.
  const swatchesFor = (teamId?: string) => [
    ...themeSwatches,
    ...teams.flatMap((other) => {
      const color = normalizeHex(other.color);
      return other.id !== teamId && color ? [{ color, label: other.name }] : [];
    }),
  ];
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-1">
      {teams.length === 0 ? (
        <p className="text-foreground/70 text-sm">No {teamLabel}s yet.</p>
      ) : (
        <ul aria-label={`${teamLabel}s`}>
          {teams.map((team) => (
            // Keyed on the saved values so a refresh resets the row's fields.
            <TeamRow
              key={`${team.id}-${team.name}-${team.color}-${team.logoUrl}`}
              warWeekId={warWeekId}
              team={team}
              teamLabel={teamLabel}
              swatches={swatchesFor(team.id)}
            />
          ))}
        </ul>
      )}
      <ul>
        <TeamRow
          warWeekId={warWeekId}
          teamLabel={teamLabel}
          swatches={swatchesFor()}
        />
      </ul>
    </div>
  );
}

/** The roster: every Participant, editable in place, then "Add Participant". */
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
  const rowProps = {
    warWeekId,
    teams,
    teamLabel,
    leaderTitle,
    tagSuggestions,
  };
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-1">
      {participants.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Participants yet.</p>
      ) : (
        <ul aria-label="Roster">
          {participants.map((p) => (
            <ParticipantRow
              key={[
                p.id,
                p.displayName,
                p.companyTag,
                p.email,
                p.teamId,
                p.isLeader,
              ].join("-")}
              participant={p}
              {...rowProps}
            />
          ))}
        </ul>
      )}
      <ul>
        <ParticipantRow {...rowProps} />
      </ul>
    </div>
  );
}
