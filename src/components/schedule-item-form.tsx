"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type SetupScheduleFaqActionResult,
  createScheduleItem,
  updateScheduleItem,
} from "@/actions/setup-schedule-faq";
import { EntityCombobox } from "@/components/entity-combobox";
import { OptionSelect } from "@/components/option-select";
import { RichTextEditor } from "@/components/rich-text-editor";
import { TimeCombobox } from "@/components/time-combobox";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
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

const BACK = "/admin/setup/schedule";

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
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<ScheduleItemInput>(
    initial ?? {
      ...EMPTY,
      dayId: days[0]?.id ?? "",
      competitionId: requireCompetition ? (competitions[0]?.id ?? "") : "",
    },
  );
  const [result, setResult] = useState<SetupScheduleFaqActionResult | null>(
    null,
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

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const saved = itemId
        ? await updateScheduleItem(itemId, fields)
        : await createScheduleItem(warWeekId, fields);
      setResult(saved);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success("Schedule Item saved");
      router.push(BACK);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5"
      aria-label="Schedule Item"
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="schedule-day">Day</FieldLabel>
            <OptionSelect
              id="schedule-day"
              required
              options={dayOptions}
              {...control("dayId")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-start-time">
              Start time (ET)
            </FieldLabel>
            <TimeCombobox
              id="schedule-start-time"
              required
              {...control("startTime")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-end-time">
              End time (ET, optional)
            </FieldLabel>
            <TimeCombobox
              id="schedule-end-time"
              start={fields.startTime}
              {...control("endTime")}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="schedule-title">Title</FieldLabel>
          <Input
            id="schedule-title"
            required
            maxLength={200}
            className="h-11 sm:h-9"
            {...text("title")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="schedule-category">Category</FieldLabel>
            <OptionSelect
              id="schedule-category"
              required
              options={CATEGORIES}
              {...control("category")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-competition">
              Competition (optional)
            </FieldLabel>
            <EntityCombobox
              id="schedule-competition"
              items={competitionItems}
              placeholder="No Competition"
              {...control("competitionId")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-host">Host (optional)</FieldLabel>
            <Input
              id="schedule-host"
              maxLength={200}
              className="h-11 sm:h-9"
              {...text("host")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="schedule-location">
              Location (optional)
            </FieldLabel>
            <Input
              id="schedule-location"
              maxLength={200}
              className="h-11 sm:h-9"
              {...text("location")}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="schedule-virtual-link">
            Virtual link (optional)
          </FieldLabel>
          <Input
            id="schedule-virtual-link"
            type="url"
            maxLength={500}
            placeholder="https://"
            className="h-11 sm:h-9"
            {...text("virtualLink")}
          />
        </Field>

        <Field>
          <FieldLabel>Description (optional)</FieldLabel>
          <RichTextEditor
            content={fields.description as Content}
            onChange={(description) => set("description", description)}
            label="Description"
          />
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
      {result && !result.ok && !pending && (
        <FieldError>{result.error}</FieldError>
      )}
    </form>
  );
}
