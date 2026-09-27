"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type NextWarWeekActionResult,
  createNextWarWeek,
} from "@/actions/war-week-lifecycle";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import type { NextWarWeekInput } from "@/lib/war-week-lifecycle";

type CopyOption = "copySettings" | "copyCompetitions" | "copyFaq";

const COPY_OPTIONS: { field: CopyOption; label: string; help: string }[] = [
  {
    field: "copySettings",
    label: "Settings and Appearance Theme",
    help: "Mode, Team Label, Leader Title, Slack and wiki links, colors, font, logo and banner.",
  },
  {
    field: "copyCompetitions",
    label: "Competitions",
    help: "With their Placement Points, scoring and Hosts. No Points Entries.",
  },
  { field: "copyFaq", label: "FAQ", help: "Every FAQ Item." },
];

type Values = {
  edition: string;
  editionNumber: string;
  year: string;
  startDate: string;
  endDate: string;
  storyTheme: string;
  copySettings: boolean;
  copyCompetitions: boolean;
  copyFaq: boolean;
};

/**
 * Create next War Week: edition, number, year, dates and Story Theme, plus
 * what to copy from `fromEdition`. It starts `upcoming`; Teams, roster,
 * Days, Schedule, Points Entries, Awards and Announcements never copy.
 */
export function NextWarWeekForm({
  fromWarWeekId,
  fromEdition,
  defaults,
}: {
  fromWarWeekId: string;
  fromEdition: string;
  defaults: { edition: string; editionNumber: number; year: number };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>({
    edition: defaults.edition.toUpperCase(),
    editionNumber: String(defaults.editionNumber),
    year: String(defaults.year),
    startDate: "",
    endDate: "",
    storyTheme: "",
    copySettings: true,
    copyCompetitions: false,
    copyFaq: false,
  });

  const setText =
    (field: "edition" | "editionNumber" | "year" | "storyTheme") =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [field]: event.target.value }));
    };

  // Validation runs on the server; a refusal names its fields.
  const [result, formAction, pending] = useActionState(
    async (
      _previous: NextWarWeekActionResult | null,
      formData: FormData,
    ): Promise<NextWarWeekActionResult> => {
      const input: NextWarWeekInput = {
        edition: String(formData.get("edition") ?? ""),
        editionNumber: String(formData.get("editionNumber") ?? ""),
        year: String(formData.get("year") ?? ""),
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        storyTheme: String(formData.get("storyTheme") ?? ""),
        copySettings: formData.get("copySettings") === "on",
        copyCompetitions: formData.get("copyCompetitions") === "on",
        copyFaq: formData.get("copyFaq") === "on",
      };
      const result = await createNextWarWeek(fromWarWeekId, input);
      if (!result.ok) {
        toast.error(result.error);
        return result;
      }
      toast.success(`War Week ${result.edition.toUpperCase()} created`);
      router.push("/admin/setup");
      router.refresh();
      return result;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);
  const dateError = fieldErrors.startDate ?? fieldErrors.endDate;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-6"
      aria-label="Create next War Week"
    >
      <FieldSet>
        <FieldLegend className="mb-2 font-semibold">New edition</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={!!fieldErrors.edition}>
            <FieldLabel htmlFor="next-edition">Edition</FieldLabel>
            <Input
              id="next-edition"
              name="edition"
              className="h-11 sm:h-9"
              required
              maxLength={8}
              aria-invalid={!!fieldErrors.edition}
              value={values.edition}
              onChange={setText("edition")}
            />
            <FieldError>{fieldErrors.edition}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.editionNumber}>
            <FieldLabel htmlFor="next-editionNumber">Edition number</FieldLabel>
            <Input
              id="next-editionNumber"
              name="editionNumber"
              className="h-11 sm:h-9"
              inputMode="numeric"
              required
              aria-invalid={!!fieldErrors.editionNumber}
              value={values.editionNumber}
              onChange={setText("editionNumber")}
            />
            <FieldError>{fieldErrors.editionNumber}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.year}>
            <FieldLabel htmlFor="next-year">Year</FieldLabel>
            <Input
              id="next-year"
              name="year"
              className="h-11 sm:h-9"
              inputMode="numeric"
              required
              aria-invalid={!!fieldErrors.year}
              value={values.year}
              onChange={setText("year")}
            />
            <FieldError>{fieldErrors.year}</FieldError>
          </Field>
          <Field className="sm:col-span-3" data-invalid={!!dateError}>
            <FieldLabel htmlFor="next-dates">Dates</FieldLabel>
            <DateRangePicker
              id="next-dates"
              startName="startDate"
              endName="endDate"
              aria-invalid={!!dateError}
              value={{ start: values.startDate, end: values.endDate }}
              days={[]}
              onValueChange={({ start, end }) =>
                setValues((v) => ({ ...v, startDate: start, endDate: end }))
              }
            />
            <FieldError>{dateError}</FieldError>
          </Field>
          <Field
            className="sm:col-span-3"
            data-invalid={!!fieldErrors.storyTheme}
          >
            <FieldLabel htmlFor="next-storyTheme">Story Theme</FieldLabel>
            <Input
              id="next-storyTheme"
              name="storyTheme"
              className="h-11 sm:h-9"
              required
              maxLength={120}
              aria-invalid={!!fieldErrors.storyTheme}
              value={values.storyTheme}
              onChange={setText("storyTheme")}
            />
            <FieldError>{fieldErrors.storyTheme}</FieldError>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend className="mb-2 font-semibold">
          Copy from War Week {fromEdition.toUpperCase()}
        </FieldLegend>
        <FieldDescription>
          Teams, roster, Days, Schedule, Points Entries, Awards and
          Announcements are never copied.
        </FieldDescription>
        <FieldGroup className="gap-4">
          {COPY_OPTIONS.map(({ field, label, help }) => (
            <Field key={field} orientation="horizontal" className="min-h-11">
              <Switch
                id={`next-${field}`}
                name={field}
                checked={values[field]}
                onCheckedChange={(checked) =>
                  setValues((v) => ({ ...v, [field]: checked }))
                }
              />
              <div className="flex flex-col gap-0.5">
                <FieldLabel htmlFor={`next-${field}`}>{label}</FieldLabel>
                <FieldDescription>{help}</FieldDescription>
              </div>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 self-start sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Creating…" : "Create War Week"}
        </Button>
        {formError && !pending && <FieldError>{formError}</FieldError>}
      </div>
    </form>
  );
}
