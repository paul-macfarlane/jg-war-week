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
import {
  ResponsiveSheetDialog,
  ResponsiveSheetDialogDescription,
  ResponsiveSheetDialogFooter,
  ResponsiveSheetDialogHeader,
  ResponsiveSheetDialogTitle,
} from "@/components/responsive-sheet-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { NextWarWeekInput } from "@/lib/war-week-lifecycle";

type Values = {
  edition: string;
  editionNumber: string;
  year: string;
  startDate: string;
  endDate: string;
  storyTheme: string;
};

/**
 * The Lifecycle section's Create next War Week button, which opens the form
 * in a dialog. The page shows it only for the latest War Week once it is
 * complete (`canCreateNextWarWeek`).
 */
export function NextWarWeekButton(props: {
  fromWarWeekId: string;
  defaults: { edition: string; editionNumber: number; year: number };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="min-h-11 self-start sm:min-h-9"
        onClick={() => setOpen(true)}
      >
        Create next War Week
      </Button>
      <ResponsiveSheetDialog open={open} onOpenChange={setOpen}>
        {/* Mounted per opening, so each starts from the defaults. */}
        {open ? (
          <NextWarWeekForm {...props} onCreated={() => setOpen(false)} />
        ) : null}
      </ResponsiveSheetDialog>
    </>
  );
}

/**
 * Create next War Week: edition, number, year, dates and Story Theme. It
 * starts `upcoming` with default settings and copies nothing: no
 * Competitions, FAQ, Teams or roster.
 */
function NextWarWeekForm({
  fromWarWeekId,
  defaults,
  onCreated,
}: {
  fromWarWeekId: string;
  defaults: { edition: string; editionNumber: number; year: number };
  onCreated: () => void;
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
      };
      const result = await createNextWarWeek(fromWarWeekId, input);
      if (!result.ok) {
        toast.error(result.error);
        return result;
      }
      toast.success(`War Week ${result.edition.toUpperCase()} created`);
      onCreated();
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
      className="flex flex-col gap-4"
      aria-label="Create next War Week"
    >
      <ResponsiveSheetDialogHeader>
        <ResponsiveSheetDialogTitle>
          Create next War Week
        </ResponsiveSheetDialogTitle>
        <ResponsiveSheetDialogDescription>
          It starts upcoming with default settings and nothing copied, so the
          current War Week stays current until you start the new one.
        </ResponsiveSheetDialogDescription>
      </ResponsiveSheetDialogHeader>
      <FieldGroup className="grid gap-4 px-4 sm:grid-cols-3">
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
      <ResponsiveSheetDialogFooter>
        <Button
          type="submit"
          size="lg"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Creating…" : "Create War Week"}
        </Button>
        {formError && !pending && <FieldError>{formError}</FieldError>}
      </ResponsiveSheetDialogFooter>
    </form>
  );
}
