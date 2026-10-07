"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type SetupScheduleFaqActionResult,
  createScheduleItem,
  updateScheduleItem,
} from "@/actions/setup-schedule-faq";
import { EntityCombobox } from "@/components/entity-combobox";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { OptionSelect } from "@/components/option-select";
import { ParticipantPicker } from "@/components/participant-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
} from "@/components/setup-row";
import { TimeCombobox } from "@/components/time-combobox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ScheduleItem } from "@/db/schema";
import type { ParticipantOption } from "@/lib/participant-options";
import type { Content } from "@/lib/rich-text/content";
import { formatDayHeading } from "@/lib/schedule";
import type { ScheduleItemInput } from "@/lib/setup-schedule-faq";

const CATEGORIES = [
  { value: "competition", label: "Competition" },
  { value: "education", label: "Education" },
  { value: "social", label: "Social" },
  { value: "meal", label: "Meal" },
  { value: "work", label: "Work" },
  { value: "other", label: "Other" },
] as const satisfies ReadonlyArray<{
  value: ScheduleItem["category"];
  label: string;
}>;

const EMPTY: ScheduleItemInput = {
  dayId: "",
  startTime: "",
  endTime: "",
  title: "",
  hostIds: [],
  location: "",
  virtualLink: "",
  category: "social",
  competitionId: "",
  description: { type: "doc", content: [] },
};

/**
 * Add or edit one Schedule Item, in its Sheet on the Schedule page. Times
 * are ET wall-clock times on the chosen Day. The server action checks the
 * times, the Day and the (Day, start time, title) key; its error is what's
 * shown. `onSaved` closes the Sheet.
 */
export function ScheduleItemForm({
  warWeekId,
  itemId,
  initial,
  days,
  competitions,
  hostOptions,
  onSaved,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Set when editing an existing Schedule Item. */
  itemId?: string;
  initial?: ScheduleItemInput;
  days: { id: string; date: string; dayTheme: string }[];
  competitions: { id: string; name: string }[];
  /** The roster, for the Hosts picker: names and Avatars, never an email. */
  hostOptions: ParticipantOption[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<ScheduleItemInput>(
    initial ?? {
      ...EMPTY,
      dayId: days[0]?.id ?? "",
      competitionId: "",
    },
  );

  function set<K extends keyof ScheduleItemInput>(
    key: K,
    value: ScheduleItemInput[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  /** The fields an input or select holds as one string. */
  type TextKey = Exclude<keyof ScheduleItemInput, "description" | "hostIds">;

  function text(key: TextKey) {
    return {
      name: key,
      value: fields[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        set(key, event.target.value),
    };
  }

  /** Name, value and change wiring for a custom control. */
  function control(key: TextKey) {
    return {
      name: key,
      value: fields[key],
      onValueChange: (value: string) => set(key, value),
    };
  }

  /** Category first: a Competition belongs only to the Competition category. */
  function setCategory(category: string) {
    setFields((current) => ({
      ...current,
      category,
      competitionId: category === "competition" ? current.competitionId : "",
    }));
  }

  /** A linked Competition's Hosts are its own, so the item keeps none. */
  function setCompetition(competitionId: string) {
    setFields((current) => {
      const name = competitions.find((c) => c.id === competitionId)?.name;
      return {
        ...current,
        competitionId,
        hostIds: competitionId ? [] : current.hostIds,
        // Fills an empty title only; a typed title is never overwritten.
        title: current.title.trim() === "" && name ? name : current.title,
      };
    });
  }

  const dayOptions = days.map((day) => ({
    value: day.id,
    label: `${formatDayHeading(day.date)} · ${day.dayTheme}`,
  }));
  const competitionItems = [
    { id: "", label: "No Competition" },
    ...competitions.map((competition) => ({
      id: competition.id,
      label: competition.name,
    })),
  ];

  // Validation runs on the server; a refusal names its fields. Every field
  // is closed over from state (rather than read off `FormData`) so the
  // rich-text description survives a refusal unchanged.
  const [result, formAction, pending] = useActionState(
    async (): Promise<SetupScheduleFaqActionResult> => {
      const saved = itemId
        ? await updateScheduleItem(itemId, fields)
        : await createScheduleItem(warWeekId, fields);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success("Schedule Item saved");
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
      aria-label="Schedule Item"
    >
      <FieldGroup className="px-4">
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <Field data-invalid={!!fieldErrors.dayId}>
            <FieldLabel htmlFor="schedule-day">Day</FieldLabel>
            <OptionSelect
              id="schedule-day"
              required
              aria-invalid={!!fieldErrors.dayId}
              options={dayOptions}
              {...control("dayId")}
            />
            <FieldError>{fieldErrors.dayId}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.startTime}>
            <FieldLabel htmlFor="schedule-start-time">
              Start (optional)
            </FieldLabel>
            <TimeCombobox
              id="schedule-start-time"
              aria-invalid={!!fieldErrors.startTime}
              {...control("startTime")}
            />
            <FieldError>{fieldErrors.startTime}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.endTime}>
            <FieldLabel htmlFor="schedule-end-time">End (optional)</FieldLabel>
            <TimeCombobox
              id="schedule-end-time"
              start={fields.startTime}
              aria-invalid={!!fieldErrors.endTime}
              {...control("endTime")}
            />
            <FieldError>{fieldErrors.endTime}</FieldError>
          </Field>
        </div>
        <FieldDescription className="-mt-2">
          Times are Eastern (ET). With no start time the item reads &ldquo;Any
          time&rdquo;.
        </FieldDescription>

        <Field data-invalid={!!fieldErrors.title}>
          <FieldLabel htmlFor="schedule-title">Title</FieldLabel>
          <Input
            id="schedule-title"
            required
            maxLength={200}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.title}
            {...text("title")}
          />
          <FieldError>{fieldErrors.title}</FieldError>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field data-invalid={!!fieldErrors.category}>
            <FieldLabel htmlFor="schedule-category">Category</FieldLabel>
            <OptionSelect
              id="schedule-category"
              required
              aria-invalid={!!fieldErrors.category}
              options={CATEGORIES}
              name="category"
              value={fields.category}
              onValueChange={setCategory}
            />
            <FieldError>{fieldErrors.category}</FieldError>
          </Field>
          {fields.category === "competition" ? (
            <Field data-invalid={!!fieldErrors.competitionId}>
              <FieldLabel htmlFor="schedule-competition">
                Competition (optional)
              </FieldLabel>
              <EntityCombobox
                id="schedule-competition"
                aria-invalid={!!fieldErrors.competitionId}
                items={competitionItems}
                placeholder="No Competition"
                name="competitionId"
                value={fields.competitionId}
                onValueChange={setCompetition}
              />
              <FieldError>{fieldErrors.competitionId}</FieldError>
            </Field>
          ) : null}
          <Field data-invalid={!!fieldErrors.location}>
            <FieldLabel htmlFor="schedule-location">
              Location (optional)
            </FieldLabel>
            <Input
              id="schedule-location"
              maxLength={200}
              className="h-11 sm:h-9"
              aria-invalid={!!fieldErrors.location}
              {...text("location")}
            />
            <FieldError>{fieldErrors.location}</FieldError>
          </Field>
        </div>

        {fields.competitionId ? null : (
          <Field data-invalid={!!fieldErrors.hostIds}>
            <FieldLabel htmlFor="schedule-hosts">Hosts (optional)</FieldLabel>
            <ParticipantPicker
              multiple
              id="schedule-hosts"
              aria-label="Hosts"
              aria-invalid={!!fieldErrors.hostIds}
              options={hostOptions}
              value={fields.hostIds}
              onValueChange={(hostIds) => set("hostIds", hostIds)}
              placeholder="Search the roster by name"
              emptyText="No one on the roster matches."
            />
            <FieldDescription>
              Shown as &ldquo;Hosted by&rdquo; on the Schedule. It doesn&apos;t
              give anyone access.
            </FieldDescription>
            <FieldError>{fieldErrors.hostIds}</FieldError>
          </Field>
        )}

        <Field data-invalid={!!fieldErrors.virtualLink}>
          <FieldLabel htmlFor="schedule-virtual-link">
            Virtual link (optional)
          </FieldLabel>
          <Input
            id="schedule-virtual-link"
            type="url"
            maxLength={500}
            placeholder="https://"
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.virtualLink}
            {...text("virtualLink")}
          />
          <FieldError>{fieldErrors.virtualLink}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.description}>
          <FieldTitle id="schedule-description-label">
            Description (optional)
          </FieldTitle>
          <RichTextEditor
            content={fields.description as Content}
            onChange={(description) => set("description", description)}
            label="Description"
            labelId="schedule-description-label"
            placeholder="Add details (optional)…"
          />
          <FieldError>{fieldErrors.description}</FieldError>
        </Field>
      </FieldGroup>

      <SetupSheetFooter>
        <SetupSaveButton
          pending={pending}
          label={itemId ? "Save" : "Add Schedule Item"}
        />
        <SetupRowError error={pending ? null : formError} />
      </SetupSheetFooter>
    </form>
  );
}
