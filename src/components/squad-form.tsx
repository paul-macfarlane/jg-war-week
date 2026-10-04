"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type BracketActionResult,
  createSquad,
  updateSquad,
} from "@/actions/brackets";
import { EntityCombobox } from "@/components/entity-combobox";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { OptionSelect } from "@/components/option-select";
import {
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogFooter,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SQUAD_LIMITS } from "@/lib/bracket/squads";
import type { SquadRow } from "@/queries/brackets";

/** A Participant the form can put in a Squad, with their Team. */
export type SquadFormParticipant = {
  id: string;
  name: string;
  teamId: string | null;
};

/**
 * A Squad's name, {Team Label} and Participants, in a ResponsiveSheetDialog from the Bracket
 * builder. Only the chosen Team's Participants are offered; one already in
 * another Squad of this Competition shows "in <Squad>" and the server
 * refuses them. Posts JSON (decision 13); a refused field shows its error
 * and takes focus (ADR 0004).
 */
export function SquadForm({
  competitionId,
  squad,
  teams,
  participants,
  taken,
  teamLabel,
  entered = false,
  onDone,
}: {
  competitionId: string;
  /** The Squad being edited; none to add one. */
  squad?: SquadRow;
  teams: { id: string; name: string }[];
  participants: SquadFormParticipant[];
  /** Participant id → the other Squad of this Competition they're in. */
  taken: Record<string, string>;
  teamLabel: string;
  /** Whether the Squad being edited is an Entrant: its Team is fixed. */
  entered?: boolean;
  /** Closes the form: after a save, or on Cancel. */
  onDone: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(squad?.name ?? "");
  const [teamId, setTeamId] = useState(squad?.teamId ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>(
    squad?.participants.map((p) => p.id) ?? [],
  );

  const [result, formAction, pending] = useActionState(
    async (): Promise<BracketActionResult> => {
      const values = { name, teamId, participantIds };
      const saved = squad
        ? await updateSquad(competitionId, squad.id, values)
        : await createSquad(competitionId, values);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success(squad ? "Squad saved" : "Squad added");
      onDone();
      router.refresh();
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);

  const teamOptions = [
    { value: "", label: `Choose a ${teamLabel}` },
    ...teams.map((team) => ({ value: team.id, label: team.name })),
  ];
  const items = participants
    .filter((p) => teamId !== "" && p.teamId === teamId)
    .map((p) => ({
      id: p.id,
      label: p.name,
      detail: taken[p.id] ? `in ${taken[p.id]}` : undefined,
    }));

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={squad ? `Edit Squad ${squad.name}` : "New Squad"}
      className="flex flex-col gap-4"
    >
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>
          {squad ? `Edit ${squad.name}` : "Add Squad"}
        </ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          A Squad is a named group of Participants from one {teamLabel}, entered
          as one Entrant. Its Placement Points go to its {teamLabel}.
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <FieldGroup className="gap-4 px-4">
        <Field data-invalid={!!fieldErrors.name}>
          <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
          <Input
            id={`${id}-name`}
            name="name"
            required
            maxLength={SQUAD_LIMITS.nameMax}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.teamId}>
          <FieldLabel htmlFor={`${id}-team`}>{teamLabel}</FieldLabel>
          <OptionSelect
            id={`${id}-team`}
            aria-invalid={!!fieldErrors.teamId}
            options={teamOptions}
            value={teamId}
            disabled={entered}
            onValueChange={(next) => {
              setTeamId(next);
              // A Squad's Participants are all on its Team.
              setParticipantIds((ids) =>
                ids.filter(
                  (pid) =>
                    participants.find((p) => p.id === pid)?.teamId === next,
                ),
              );
            }}
          />
          {entered && (
            <FieldDescription>
              An entered Squad keeps its {teamLabel}.
            </FieldDescription>
          )}
          <FieldError>{fieldErrors.teamId}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.participantIds}>
          <FieldLabel htmlFor={`${id}-participants`}>
            Participants ({participantIds.length} chosen)
          </FieldLabel>
          <EntityCombobox
            id={`${id}-participants`}
            multiple
            items={items}
            value={participantIds}
            onValueChange={setParticipantIds}
            disabled={teamId === ""}
            aria-invalid={!!fieldErrors.participantIds}
            placeholder={
              teamId === "" ? `Choose a ${teamLabel} first` : "Find by name"
            }
          />
          <FieldDescription>
            1–{SQUAD_LIMITS.participantsMax} Participants, each in one Squad of
            this Competition.
          </FieldDescription>
          <FieldError>{fieldErrors.participantIds}</FieldError>
        </Field>
        {formError && !pending && <FieldError>{formError}</FieldError>}
      </FieldGroup>
      <ResponsiveSheetDialogFooter className="flex-row flex-wrap">
        <Button type="submit" size="lg" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11"
          disabled={pending}
          onClick={onDone}
        >
          Cancel
        </Button>
      </ResponsiveSheetDialogFooter>
    </form>
  );
}
