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
import { RichTextEditor } from "@/components/rich-text-editor";
import { TimeCombobox } from "@/components/time-combobox";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ScheduleItem } from "@/db/schema";
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
  host: "",
  location: "",
  virtualLink: "",
  category: "social",
  competitionId: "",
  description: { type: "doc", content: [] },
};

const BACK = "/admin/schedule";

/**
 * Add or edit one Schedule Item. Times are ET wall-clock times on the chosen
 * Day. The server action checks the times, the Day and the (Day, start time,
 * title) key; its error is what's shown.
 */
export function ScheduleItemForm({
  warWeekId,
  itemId,
  requireCompetition = false,
  initial,
  days,
  competitions,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /**
   * A Host must link each Schedule Item to a Competition they host, so the
   * form offers no "No Competition" choice.
   */
  requireCompetition?: boolean;
  /** Set when editing an existing Schedule Item. */
  itemId?: string;
  initial?: ScheduleItemInput;
  days: { id: string; date: string; dayTheme: string }[];
  competitions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<ScheduleItemInput>(
    initial ?? {
      ...EMPTY,
      dayId: days[0]?.id ?? "",
      competitionId: requireCompetition ? (competitions[0]?.id ?? "") : "",
    },
  );

  function set<K extends keyof ScheduleItemInput>(
    key: K,
    value: ScheduleItemInput[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function text(key: Exclude<keyof ScheduleItemInput, "description">) {
    return {
      name: key,
      value: fields[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        set(key, event.target.value),
    };
  }

  /** Name, value and change wiring for a custom control. */
  function control(key: Exclude<keyof ScheduleItemInput, "description">) {
    return {
      name: key,
      value: fields[key],
      onValueChange: (value: string) => set(key, value),
    };
  }

  const dayOptions = days.map((day) => ({
    value: day.id,
    label: `${formatDayHeading(day.date)} · ${day.dayTheme}`,
  }));
  const competitionItems = [
    ...(requireCompetition ? [] : [{ id: "", label: "No Competition" }]),
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
      router.push(BACK);
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
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-3">
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
              Start time (ET)
            </FieldLabel>
            <TimeCombobox
              id="schedule-start-time"
              required
              aria-invalid={!!fieldErrors.startTime}
              {...control("startTime")}
            />
            <FieldError>{fieldErrors.startTime}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.endTime}>
            <FieldLabel htmlFor="schedule-end-time">
              End time (ET, optional)
            </FieldLabel>
            <TimeCombobox
              id="schedule-end-time"
              start={fields.startTime}
              aria-invalid={!!fieldErrors.endTime}
              {...control("endTime")}
            />
            <FieldError>{fieldErrors.endTime}</FieldError>
          </Field>
        </div>

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
              {...control("category")}
            />
            <FieldError>{fieldErrors.category}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.competitionId}>
            <FieldLabel htmlFor="schedule-competition">
              Competition (optional)
            </FieldLabel>
            <EntityCombobox
              id="schedule-competition"
              aria-invalid={!!fieldErrors.competitionId}
              items={competitionItems}
              placeholder="No Competition"
              {...control("competitionId")}
            />
            <FieldError>{fieldErrors.competitionId}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.host}>
            <FieldLabel htmlFor="schedule-host">Host (optional)</FieldLabel>
            <Input
              id="schedule-host"
              maxLength={200}
              className="h-11 sm:h-9"
              aria-invalid={!!fieldErrors.host}
              {...text("host")}
            />
            <FieldError>{fieldErrors.host}</FieldError>
          </Field>
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
          />
          <FieldError>{fieldErrors.description}</FieldError>
        </Field>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Saving…" : itemId ? "Save changes" : "Add Schedule Item"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 sm:min-h-9"
          onClick={() => router.push(BACK)}
        >
          Cancel
        </Button>
      </div>
      {formError && !pending && <FieldError>{formError}</FieldError>}
    </form>
  );
}
