"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { type BracketActionResult, setHeatSchedule } from "@/actions/brackets";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { OptionSelect } from "@/components/option-select";
import { TimeCombobox } from "@/components/time-combobox";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { HeatScheduleInput } from "@/lib/bracket/heat-schedule";
import type { Heat } from "@/lib/bracket/types";
import { formatDayHeading } from "@/lib/schedule";

const CLEARED: HeatScheduleInput = { dayId: "", startTime: "", location: "" };

/**
 * A Heat's time and place, in a Sheet on the results screen: a Day and a
 * start time (ET) together, and an optional location. Save stores them;
 * Clear empties all three. The server validates; a refused field shows its
 * error and takes focus (ADR 0004).
 */
export function HeatScheduleForm({
  competitionId,
  heat,
  name,
  days,
  onSaved,
}: {
  competitionId: string;
  heat: Pick<Heat, "id" | "dayId" | "startTime" | "location">;
  /** The Heat's name, like "Semifinal 1". */
  name: string;
  days: { id: string; date: string }[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<HeatScheduleInput>({
    dayId: heat.dayId ?? "",
    // Postgres returns `HH:MM:SS`; the time field works in `HH:MM`.
    startTime: heat.startTime?.slice(0, 5) ?? "",
    location: heat.location ?? "",
  });

  function set(key: keyof HeatScheduleInput, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  const [result, formAction, pending] = useActionState(
    async (
      prevState: BracketActionResult | null,
      formData: FormData,
    ): Promise<BracketActionResult> => {
      const clear = formData.get("intent") === "clear";
      const saved = await setHeatSchedule(
        competitionId,
        heat.id,
        prevState,
        clear ? new FormData() : formData,
      );
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      if (clear) setFields(CLEARED);
      toast.success(
        clear ? "Time and place cleared." : "Time and place saved.",
      );
      onSaved();
      router.refresh();
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);

  const dayOptions = [
    { value: "", label: "No Day" },
    ...days.map((day) => ({
      value: day.id,
      label: formatDayHeading(day.date),
    })),
  ];
  const isSet = heat.dayId !== null || heat.location !== null;

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={`Time & place for ${name}`}
      className="flex flex-col gap-4"
    >
      <SheetHeader>
        <SheetTitle>Time &amp; place · {name}</SheetTitle>
        <SheetDescription>
          When and where it&apos;s played. A timed Heat shows in Now/Next once
          its Entrants are known.
        </SheetDescription>
      </SheetHeader>
      <FieldGroup className="gap-4 px-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field data-invalid={!!fieldErrors.dayId}>
            <FieldLabel htmlFor={`${id}-day`}>Day</FieldLabel>
            <OptionSelect
              id={`${id}-day`}
              name="dayId"
              aria-invalid={!!fieldErrors.dayId}
              options={dayOptions}
              value={fields.dayId}
              onValueChange={(value) => set("dayId", value)}
            />
            <FieldError>{fieldErrors.dayId}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.startTime}>
            <FieldLabel htmlFor={`${id}-start-time`}>
              Start time (ET)
            </FieldLabel>
            <TimeCombobox
              id={`${id}-start-time`}
              name="startTime"
              aria-invalid={!!fieldErrors.startTime}
              value={fields.startTime}
              onValueChange={(value) => set("startTime", value)}
            />
            <FieldError>{fieldErrors.startTime}</FieldError>
          </Field>
        </div>
        <Field data-invalid={!!fieldErrors.location}>
          <FieldLabel htmlFor={`${id}-location`}>
            Location (optional)
          </FieldLabel>
          <Input
            id={`${id}-location`}
            name="location"
            maxLength={200}
            placeholder="e.g. Main room or Table 3"
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.location}
            value={fields.location}
            onChange={(event) => set("location", event.target.value)}
          />
          <FieldDescription>
            Set a location on its own, or with a Day and time.
          </FieldDescription>
          <FieldError>{fieldErrors.location}</FieldError>
        </Field>
        {formError && !pending && <FieldError>{formError}</FieldError>}
      </FieldGroup>
      <SheetFooter className="flex-row flex-wrap">
        <Button type="submit" size="lg" className="min-h-11" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {isSet && (
          <Button
            type="submit"
            name="intent"
            value="clear"
            variant="outline"
            size="lg"
            className="min-h-11"
            disabled={pending}
          >
            Clear
          </Button>
        )}
      </SheetFooter>
    </form>
  );
}
