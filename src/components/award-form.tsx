"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type AwardActionResult,
  createAward,
  updateAward,
} from "@/actions/awards";
import { EntityCombobox } from "@/components/entity-combobox";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { FormValueInput } from "@/components/form-value-input";
import { OptionSelect } from "@/components/option-select";
import {
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
} from "@/components/setup-row";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WarWeek } from "@/db/schema";
import {
  AWARD_DESCRIPTION_MAX,
  AWARD_NAME_MAX,
  type AwardInput,
} from "@/lib/awards";
import type { AwardFormOptions } from "@/queries/awards";

/**
 * The form's options: the query's, plus each Participant's `email`, for the
 * picker's search only, which only the Organizer-only Awards page adds.
 */
export type AwardFormPickerOptions = Omit<AwardFormOptions, "participants"> & {
  participants: (AwardFormOptions["participants"][number] & {
    email?: string;
  })[];
};

/** Base UI's Select won't accept `""` as an item value. */
const NO_TEAM = "none";

/**
 * Give or edit one Award, in its Sheet on the Awards page: name,
 * description, and its recipients — one Team, any number of Participants,
 * or both. The server action checks the recipients belong to this War
 * Week; its error is what's shown. `onSaved` closes the Sheet.
 */
export function AwardForm({
  warWeekId,
  awardId,
  initial,
  currentCategory,
  options,
  teamLabel,
  mode,
  onSaved,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Set when editing an existing Award. */
  awardId?: string;
  initial?: AwardInput;
  /** The Award's Category when editing; an archived one stays selectable. */
  currentCategory?: { id: string; name: string; archived: boolean } | null;
  options: AwardFormPickerOptions;
  /** The War Week's Team Label, e.g. "House". */
  teamLabel: string;
  /** The War Week's Mode: a free-for-all has no Team field. */
  mode: WarWeek["mode"];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [teamId, setTeamId] = useState(initial?.teamId ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [participantIds, setParticipantIds] = useState<string[]>(
    initial?.participantIds ?? [],
  );

  // A free-for-all War Week hides Team, unless the Award being edited has
  // one, so it can be cleared.
  const showTeam =
    options.teams.length > 0 && (mode !== "free-for-all" || !!initial?.teamId);

  // Also lets SelectValue show the Team's name rather than its id.
  const teamItems = [
    { value: NO_TEAM, label: `No ${teamLabel}` },
    ...options.teams.map((team) => ({ value: team.id, label: team.name })),
  ];
  const categoryItems = [
    { value: "", label: "None" },
    ...options.categories.map((c) => ({ value: c.id, label: c.name })),
    ...(currentCategory?.archived
      ? [
          {
            value: currentCategory.id,
            label: `${currentCategory.name} (archived)`,
          },
        ]
      : []),
  ];
  const participantItems = options.participants.map((p) => ({
    id: p.id,
    label: p.name,
    detail: p.team ?? undefined,
    keywords: p.email,
  }));

  // Validation runs on the server; a refusal names its fields. Every field
  // is closed over from state (rather than read off `FormData`).
  const [result, formAction, pending] = useActionState(
    async (): Promise<AwardActionResult> => {
      const input = {
        name,
        description,
        teamId: teamId || null,
        categoryId: categoryId || null,
        participantIds,
      };
      const saved = awardId
        ? await updateAward(awardId, input)
        : await createAward(warWeekId, input);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success("Award saved");
      onSaved?.();
      router.refresh();
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-5"
      aria-label="Award"
    >
      <FieldGroup className="px-4">
        <Field data-invalid={!!fieldErrors.name}>
          <FieldLabel htmlFor="award-name">Name</FieldLabel>
          <Input
            id="award-name"
            name="name"
            required
            maxLength={AWARD_NAME_MAX}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.description}>
          <FieldLabel htmlFor="award-description">Description</FieldLabel>
          <Textarea
            id="award-description"
            name="description"
            rows={3}
            maxLength={AWARD_DESCRIPTION_MAX}
            aria-invalid={!!fieldErrors.description}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FieldError>{fieldErrors.description}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.categoryId}>
          <FieldLabel htmlFor="award-category">Category</FieldLabel>
          <OptionSelect
            id="award-category"
            name="categoryId"
            value={categoryId}
            onValueChange={setCategoryId}
            options={categoryItems}
            aria-invalid={!!fieldErrors.categoryId}
          />
          <FieldDescription>
            Groups this Award with the same Category in other War Weeks.
          </FieldDescription>
          <FieldError>{fieldErrors.categoryId}</FieldError>
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Recipients</FieldLegend>
          <FieldDescription>
            {showTeam
              ? `A ${teamLabel}, Participants, or both.`
              : "Participants only."}{" "}
            Awards don&apos;t affect the Standings.
          </FieldDescription>

          <FieldGroup>
            {showTeam && (
              <Field data-invalid={!!fieldErrors.teamId}>
                <FieldLabel htmlFor="award-team">{teamLabel}</FieldLabel>
                <Select
                  value={teamId === "" ? NO_TEAM : teamId}
                  items={teamItems}
                  onValueChange={(value) =>
                    setTeamId(!value || value === NO_TEAM ? "" : value)
                  }
                >
                  <SelectTrigger
                    id="award-team"
                    aria-invalid={!!fieldErrors.teamId}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teamItems.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="min-h-11 sm:min-h-8"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* "" posts as no Team. */}
                <FormValueInput name="teamId" value={teamId} />
                <FieldError>{fieldErrors.teamId}</FieldError>
              </Field>
            )}

            <Field data-invalid={!!fieldErrors.participantIds}>
              <FieldLabel htmlFor="award-participants">
                Participants ({participantIds.length} chosen)
              </FieldLabel>
              <EntityCombobox
                id="award-participants"
                multiple
                name="participantIds"
                aria-invalid={!!fieldErrors.participantIds}
                items={participantItems}
                value={participantIds}
                onValueChange={setParticipantIds}
                placeholder={
                  showTeam ? `Find by name or ${teamLabel}` : "Find by name"
                }
              />
              <FieldError>{fieldErrors.participantIds}</FieldError>
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <SetupSheetFooter>
        <SetupSaveButton
          pending={pending}
          label={awardId ? "Save" : "Add Award"}
        />
        <SetupRowError error={pending ? null : formError} />
      </SetupSheetFooter>
    </form>
  );
}
