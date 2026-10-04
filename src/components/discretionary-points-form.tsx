"use client";

import { useId, useState } from "react";

import {
  createDiscretionaryPoints,
  updateDiscretionaryPoints,
} from "@/actions/discretionary-points";
import { EntityCombobox } from "@/components/entity-combobox";
import {
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
  useSetupRow,
} from "@/components/setup-row";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { WarWeek } from "@/db/schema";

export type DiscretionaryTarget = {
  id: string;
  name: string;
  /** Shown muted beside the name: "Team" for a Team, else the Team's name. */
  detail?: string;
  /** A Participant's roster email: searched, never shown. */
  email?: string;
};

export type DiscretionaryInitial = {
  targetId: string;
  points: string;
  reason: string;
};

/**
 * Give or edit Discretionary points, in a Sheet: one Team or Participant,
 * the points (a number, negative allowed) and the required reason. With an
 * `entryId` it edits that entry. `onSaved` closes the Sheet.
 */
export function DiscretionaryPointsForm({
  warWeekId,
  targets,
  teamLabel,
  mode,
  entryId,
  initial,
  onSaved,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  targets: DiscretionaryTarget[];
  teamLabel: string;
  /** The War Week's Mode: a free-for-all has no Teams to ask about. */
  mode: WarWeek["mode"];
  entryId?: string;
  initial?: DiscretionaryInitial;
  onSaved: () => void;
}) {
  const id = useId();
  const [targetId, setTargetId] = useState(initial?.targetId ?? "");
  const [points, setPoints] = useState(initial?.points ?? "");
  const [reason, setReason] = useState(initial?.reason ?? "");
  const { pending, formRef, formAction, fieldErrors, error } = useSetupRow(
    () => {
      const input = { targetId, points, reason };
      return entryId
        ? updateDiscretionaryPoints(entryId, input)
        : createDiscretionaryPoints(warWeekId, input);
    },
    "Discretionary points saved",
    onSaved,
  );
  const targetLabel =
    mode === "free-for-all" ? "Participant" : `${teamLabel} or Participant`;

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={entryId ? "Discretionary points" : "New Discretionary points"}
      className="flex flex-col gap-4"
    >
      <FieldGroup className="gap-4 px-4">
        <Field data-invalid={!!fieldErrors.targetId}>
          <FieldLabel htmlFor={`${id}-target`}>{targetLabel}</FieldLabel>
          <EntityCombobox
            id={`${id}-target`}
            name="targetId"
            aria-label={targetLabel}
            aria-invalid={!!fieldErrors.targetId}
            required
            placeholder={`Choose a ${targetLabel.toLowerCase()}…`}
            items={targets.map((t) => ({
              id: t.id,
              label: t.name,
              detail: t.detail,
              keywords: t.email,
            }))}
            value={targetId}
            onValueChange={setTargetId}
          />
          <FieldError>{fieldErrors.targetId}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.points}>
          <FieldLabel htmlFor={`${id}-points`}>Points</FieldLabel>
          <Input
            id={`${id}-points`}
            name="points"
            required
            // Text, not number: React's post-action form reset blanks a
            // focused number input. The server validates the number.
            inputMode="decimal"
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.points}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
          <FieldError>{fieldErrors.points}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.reason}>
          <FieldLabel htmlFor={`${id}-reason`}>Reason</FieldLabel>
          <Input
            id={`${id}-reason`}
            name="reason"
            required
            maxLength={500}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldError>{fieldErrors.reason}</FieldError>
        </Field>
      </FieldGroup>

      <SetupSheetFooter>
        <SetupSaveButton
          pending={pending}
          label={entryId ? "Save" : "Give Discretionary points"}
        />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}
