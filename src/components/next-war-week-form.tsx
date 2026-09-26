"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createNextWarWeek } from "@/actions/war-week-lifecycle";
import { DateRangePicker } from "@/components/date-range-picker";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
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
      setError(null);
    };

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createNextWarWeek(fromWarWeekId, values);
      if (result.ok) {
        toast.success(`War Week ${result.edition.toUpperCase()} created`);
        router.push("/admin/setup");
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-6"
      aria-label="Create next War Week"
    >
      <FieldSet>
        <FieldLegend className="mb-2 font-semibold">New edition</FieldLegend>
        <FieldGroup className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="next-edition">Edition</FieldLabel>
            <Input
              id="next-edition"
              name="edition"
              className="h-11 sm:h-9"
              required
              maxLength={8}
              value={values.edition}
              onChange={setText("edition")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="next-editionNumber">Edition number</FieldLabel>
            <Input
              id="next-editionNumber"
              name="editionNumber"
              className="h-11 sm:h-9"
              inputMode="numeric"
              required
              value={values.editionNumber}
              onChange={setText("editionNumber")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="next-year">Year</FieldLabel>
            <Input
              id="next-year"
              name="year"
              className="h-11 sm:h-9"
              inputMode="numeric"
              required
              value={values.year}
              onChange={setText("year")}
            />
          </Field>
          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="next-dates">Dates</FieldLabel>
            <DateRangePicker
              id="next-dates"
              startName="startDate"
              endName="endDate"
              value={{ start: values.startDate, end: values.endDate }}
              days={[]}
              onValueChange={({ start, end }) => {
                setValues((v) => ({ ...v, startDate: start, endDate: end }));
                setError(null);
              }}
            />
          </Field>
          <Field className="sm:col-span-3">
            <FieldLabel htmlFor="next-storyTheme">Story Theme</FieldLabel>
            <Input
              id="next-storyTheme"
              name="storyTheme"
              className="h-11 sm:h-9"
              required
              maxLength={120}
              value={values.storyTheme}
              onChange={setText("storyTheme")}
            />
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
        <FieldError>{pending ? null : error}</FieldError>
      </div>
    </form>
  );
}
