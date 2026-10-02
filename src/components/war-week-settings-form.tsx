"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import { type SetupActionResult, updateWarWeekSettings } from "@/actions/setup";
import { ColorField, type ColorSwatch } from "@/components/color-field";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { FormValueInput } from "@/components/form-value-input";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { StickyFormActions } from "@/components/sticky-form-actions";
import { ThemeRoot } from "@/components/theme-root";
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
import { Textarea } from "@/components/ui/textarea";
import type { WarWeek } from "@/db/schema";
import { normalizeHex } from "@/lib/color";
import type { OverrideColumn, WarWeekSettingsInput } from "@/lib/setup";
import {
  type ColorScheme,
  OVERRIDE_FIELDS,
  type Palette,
  backgroundColorScheme,
  basePalette,
  derivePalette,
  isHexPalette,
  otherScheme,
  paletteOverrides,
  themeContrastWarnings,
  themeSwatches,
  warWeekThemeStyle,
} from "@/lib/theme";

type ThemeColorField =
  | "primaryColor"
  | "primaryForegroundColor"
  | "accentColor"
  | "backgroundColor"
  | "foregroundColor";

const COLOR_FIELDS: { field: ThemeColorField; label: string }[] = [
  { field: "primaryColor", label: "Primary" },
  { field: "primaryForegroundColor", label: "Primary text" },
  { field: "accentColor", label: "Accent" },
  { field: "backgroundColor", label: "Background" },
  { field: "foregroundColor", label: "Text" },
];

// The derived palette's labels; its colors and their override columns
// (each posted by a hidden input) are `theme.ts`'s `OVERRIDE_FIELDS`.
const OVERRIDE_LABEL: Record<keyof Palette, string> = {
  primary: "Primary",
  primaryForeground: "Primary text",
  accent: "Accent",
  background: "Background",
  foreground: "Text",
};

/** Each override column of `values`, or blank for all of them. */
function overrideValues(
  values?: WarWeekSettingsInput,
): Record<OverrideColumn, string> {
  return Object.fromEntries(
    OVERRIDE_FIELDS.map(([, field]) => [field, values?.[field] ?? ""]),
  ) as Record<OverrideColumn, string>;
}

const NO_OVERRIDES = overrideValues();

const SCHEME_LABEL: Record<ColorScheme, string> = {
  light: "Light",
  dark: "Dark",
};

const MODE_OPTIONS: SelectOption[] = [
  { value: "teams", label: "Teams" },
  { value: "free-for-all", label: "Free-for-all" },
];

const FONT_OPTIONS: SelectOption[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

/**
 * Edit a War Week's settings, Appearance Theme and closing (Winner and
 * highlights). Status isn't here: Start, End and Reopen change it. The
 * Appearance Theme's five colors are the base palette; the other color
 * scheme's colors are derived from them, and each can be overridden. The
 * two previews (one per scheme) and the contrast warnings update as you
 * type; validation runs on the server, which returns a field error under
 * its field on a refusal.
 */
export function WarWeekSettingsForm({
  warWeekId,
  initial,
  dayDates,
  teamSwatches,
}: {
  /** The War Week these settings were rendered for; the save posts it. */
  warWeekId: string;
  initial: WarWeekSettingsInput;
  /** The War Week's existing Day dates, `YYYY-MM-DD`. */
  dayDates: string[];
  /** The War Week's Team colors, offered as color swatches. */
  teamSwatches: ColorSwatch[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(initial);
  const initialScheme = backgroundColorScheme(initial.backgroundColor);

  function setValue(field: keyof WarWeekSettingsInput, value: string) {
    setValues((v) => {
      const next = { ...v, [field]: value };
      const nextScheme = backgroundColorScheme(value);
      if (
        field !== "backgroundColor" ||
        nextScheme === backgroundColorScheme(v.backgroundColor)
      ) {
        return next;
      }
      // Measured against the saved background, not the last edit (a hex
      // typed key by key can pass through the other scheme): away from
      // the saved scheme the overrides go back to derived, so any set
      // after the flip, in the same save, are kept; back to it, the
      // saved overrides return.
      return {
        ...next,
        ...(nextScheme === initialScheme
          ? overrideValues(initial)
          : NO_OVERRIDES),
      };
    });
  }
  const set =
    (field: keyof WarWeekSettingsInput) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValue(field, event.target.value);

  const scheme = backgroundColorScheme(values.backgroundColor);
  const other = otherScheme(scheme);
  // The base background crossed light and dark since the last save.
  const flipNotice =
    scheme !== initialScheme
      ? `Changing the background to a ${scheme} one clears the ${other} mode colors (they'll be derived again).`
      : null;

  // Validation runs on the server; a refusal names its fields.
  const [result, formAction, pending] = useActionState(
    async (
      _previous: SetupActionResult | null,
      formData: FormData,
    ): Promise<SetupActionResult> => {
      const read = (field: keyof WarWeekSettingsInput) =>
        String(formData.get(field) ?? "");
      // Key by key, so a new settings field is a type error here.
      const input: WarWeekSettingsInput = {
        storyTheme: read("storyTheme"),
        startDate: read("startDate"),
        endDate: read("endDate"),
        mode: read("mode"),
        teamLabel: read("teamLabel"),
        leaderTitle: read("leaderTitle"),
        slackChannelUrl: read("slackChannelUrl"),
        wikiUrl: read("wikiUrl"),
        primaryColor: read("primaryColor"),
        primaryForegroundColor: read("primaryForegroundColor"),
        accentColor: read("accentColor"),
        backgroundColor: read("backgroundColor"),
        foregroundColor: read("foregroundColor"),
        overridePrimaryColor: read("overridePrimaryColor"),
        overridePrimaryForegroundColor: read("overridePrimaryForegroundColor"),
        overrideAccentColor: read("overrideAccentColor"),
        overrideBackgroundColor: read("overrideBackgroundColor"),
        overrideForegroundColor: read("overrideForegroundColor"),
        logoUrl: read("logoUrl"),
        bannerUrl: read("bannerUrl"),
        fontPreset: read("fontPreset"),
        winner: read("winner"),
        highlights: read("highlights"),
      };
      const saved = await updateWarWeekSettings(warWeekId, input);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success(
        "War Week settings saved",
        flipNotice ? { description: flipNotice } : undefined,
      );
      router.refresh();
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);

  const preview = {
    ...values,
    fontPreset: values.fontPreset as WarWeek["fontPreset"],
  };
  const warnings = themeContrastWarnings(preview);
  const base = basePalette(preview);
  const overrides = paletteOverrides(preview);
  const derived = isHexPalette(base) ? derivePalette(base, overrides) : null;

  /** Sets one override; the color it would derive to anyway is none. */
  function setOverride(
    color: keyof Palette,
    field: OverrideColumn,
    hex: string,
  ) {
    const without = derivePalette(base, { ...overrides, [color]: undefined });
    setValue(field, hex === normalizeHex(without[color]) ? "" : hex);
  }
  const swatches = [...themeSwatches(values), ...teamSwatches];
  const dateError = fieldErrors.startDate ?? fieldErrors.endDate;

  const text = (
    field: keyof WarWeekSettingsInput,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Field data-invalid={!!fieldErrors[field]}>
      <FieldLabel htmlFor={`settings-${field}`}>{label}</FieldLabel>
      <Input
        id={`settings-${field}`}
        name={field}
        className="h-11 sm:h-9"
        aria-invalid={!!fieldErrors[field]}
        value={values[field]}
        onChange={set(field)}
        {...props}
      />
      <FieldError>{fieldErrors[field]}</FieldError>
    </Field>
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      // Below md a focused field scrolls clear of the section bar, the
      // sticky Save row and its error line (7rem).
      className="flex flex-col gap-6 pb-4 [--field-scroll-mb:calc(var(--admin-bar-inset)+7rem)] md:pb-0 md:[--field-scroll-mb:0px] [&_button]:scroll-mb-(--field-scroll-mb) [&_input]:scroll-mb-(--field-scroll-mb) [&_textarea]:scroll-mb-(--field-scroll-mb)"
      aria-label="War Week settings"
    >
      <FieldSet>
        <FieldLegend className="mb-2 font-semibold">Story</FieldLegend>
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {text("storyTheme", "Story Theme", {
              required: true,
              maxLength: 120,
            })}
          </div>
          <Field className="sm:col-span-2" data-invalid={!!dateError}>
            <FieldLabel htmlFor="settings-dates">Dates</FieldLabel>
            <DateRangePicker
              id="settings-dates"
              startName="startDate"
              endName="endDate"
              aria-invalid={!!dateError}
              value={{ start: values.startDate, end: values.endDate }}
              days={dayDates}
              onValueChange={({ start, end }) =>
                setValues((v) => ({ ...v, startDate: start, endDate: end }))
              }
            />
            <FieldError>{dateError}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.mode}>
            <FieldLabel htmlFor="settings-mode">Mode</FieldLabel>
            <OptionSelect
              id="settings-mode"
              name="mode"
              aria-invalid={!!fieldErrors.mode}
              options={MODE_OPTIONS}
              value={values.mode}
              onValueChange={(mode) => setValue("mode", mode)}
            />
            <FieldError>{fieldErrors.mode}</FieldError>
          </Field>
          {/* A free-for-all has no Teams: hide the fields, keep (and post)
              their saved values so saving never wipes them. */}
          {values.mode === "free-for-all" ? (
            <>
              <FormValueInput name="teamLabel" value={initial.teamLabel} />
              <FormValueInput name="leaderTitle" value={initial.leaderTitle} />
            </>
          ) : (
            <>
              {text("teamLabel", "Team Label", {
                required: true,
                maxLength: 40,
              })}
              {text("leaderTitle", "Leader Title", {
                required: true,
                maxLength: 40,
              })}
            </>
          )}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend className="mb-2 font-semibold">Links</FieldLegend>
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("slackChannelUrl", "Slack URL", {
            type: "url",
            required: true,
          })}
          {text("wikiUrl", "Wiki URL", { placeholder: "Optional" })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend className="mb-2 font-semibold">
          Appearance Theme
        </FieldLegend>
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COLOR_FIELDS.map(({ field, label }) => (
            <Field key={field} data-invalid={!!fieldErrors[field]}>
              <FieldLabel htmlFor={`settings-${field}`}>
                {label} color
              </FieldLabel>
              <ColorField
                id={`settings-${field}`}
                name={field}
                aria-invalid={!!fieldErrors[field]}
                value={values[field]}
                swatches={swatches}
                onValueChange={(hex) => setValue(field, hex)}
              />
              <FieldError>{fieldErrors[field]}</FieldError>
            </Field>
          ))}
          <Field data-invalid={!!fieldErrors.fontPreset}>
            <FieldLabel htmlFor="settings-fontPreset">Font</FieldLabel>
            <OptionSelect
              id="settings-fontPreset"
              name="fontPreset"
              aria-invalid={!!fieldErrors.fontPreset}
              options={FONT_OPTIONS}
              value={values.fontPreset}
              onValueChange={(font) => setValue("fontPreset", font)}
            />
            <FieldError>{fieldErrors.fontPreset}</FieldError>
          </Field>
        </FieldGroup>
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("logoUrl", "Logo URL", {
            placeholder: "/themes/… or https://…",
          })}
          {text("bannerUrl", "Banner URL", {
            placeholder: "/themes/… or https://…",
          })}
        </FieldGroup>

        <FieldSet>
          <FieldLegend variant="label">
            {SCHEME_LABEL[other]} mode colors
          </FieldLegend>
          <FieldDescription>
            Derived from the colors above for viewers who choose {other} mode.
            Change one to override it.
          </FieldDescription>
          {flipNotice && (
            <p role="status" className="text-warning text-sm">
              {flipNotice}
            </p>
          )}
          {derived && (
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {OVERRIDE_FIELDS.map(([color, field]) => (
                <Field key={field} data-invalid={!!fieldErrors[field]}>
                  <FieldLabel htmlFor={`settings-${field}`}>
                    {SCHEME_LABEL[other]} {OVERRIDE_LABEL[color].toLowerCase()}{" "}
                    color
                  </FieldLabel>
                  <ColorField
                    id={`settings-${field}`}
                    aria-invalid={!!fieldErrors[field]}
                    value={derived[color]}
                    swatches={swatches}
                    onValueChange={(hex) => setOverride(color, field, hex)}
                  />
                  <FormValueInput name={field} value={values[field]} />
                  {values[field] ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="min-h-11 self-start sm:min-h-6"
                      onClick={() => setValue(field, "")}
                    >
                      Reset to derived
                    </Button>
                  ) : (
                    <FieldDescription>Derived</FieldDescription>
                  )}
                  <FieldError>{fieldErrors[field]}</FieldError>
                </Field>
              ))}
            </FieldGroup>
          )}
        </FieldSet>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(["light", "dark"] as const).map((previewScheme) => (
            <ThemeRoot
              key={previewScheme}
              scheme={previewScheme}
              style={warWeekThemeStyle(preview)}
              className="bg-background text-foreground border-border flex flex-col gap-3 rounded-lg border p-4 font-sans"
            >
              <div
                aria-label={`${SCHEME_LABEL[previewScheme]} mode preview`}
                className="flex flex-col gap-3"
              >
                <span className="text-foreground/60 text-xs font-medium tracking-wide uppercase">
                  {SCHEME_LABEL[previewScheme]} mode
                  {previewScheme === scheme ? "" : " (derived)"}
                </span>
                <p className="text-primary text-xl font-semibold">
                  {values.storyTheme || "Story Theme"}
                </p>
                <p className="text-sm">Body text on the background.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-sm font-medium">
                    Primary button
                  </span>
                  <span className="bg-accent text-accent-foreground rounded-lg px-3 py-1.5 text-sm font-medium">
                    Accent
                  </span>
                </div>
              </div>
            </ThemeRoot>
          ))}
        </div>
        {warnings.length > 0 && (
          <ul
            aria-label="Contrast warnings"
            className="text-warning flex flex-col gap-1 text-sm"
          >
            {warnings.map((warning) => (
              <li key={warning}>⚠ {warning}</li>
            ))}
          </ul>
        )}
      </FieldSet>

      <FieldSet>
        <FieldLegend className="mb-2 font-semibold">Closing</FieldLegend>
        <FieldGroup className="grid gap-4">
          <Field data-invalid={!!fieldErrors.winner}>
            <FieldLabel htmlFor="settings-winner">Winner</FieldLabel>
            <Input
              id="settings-winner"
              name="winner"
              className="h-11 sm:h-9"
              maxLength={200}
              placeholder="Set when the War Week ends"
              aria-invalid={!!fieldErrors.winner}
              value={values.winner}
              onChange={set("winner")}
            />
            <FieldDescription>
              Shown in the Archive. A tie reads &ldquo;Tie: Red &amp;
              Blue&rdquo;.
            </FieldDescription>
            <FieldError>{fieldErrors.winner}</FieldError>
          </Field>
          <Field data-invalid={!!fieldErrors.highlights}>
            <FieldLabel htmlFor="settings-highlights">Highlights</FieldLabel>
            <Textarea
              id="settings-highlights"
              name="highlights"
              rows={4}
              aria-invalid={!!fieldErrors.highlights}
              value={values.highlights}
              onChange={(event) => setValue("highlights", event.target.value)}
            />
            <FieldDescription>
              One short line each, shown in the Archive.
            </FieldDescription>
            <FieldError>{fieldErrors.highlights}</FieldError>
          </Field>
        </FieldGroup>
      </FieldSet>

      <StickyFormActions className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="lg"
            className="min-h-11 sm:min-h-9"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
        {formError && !pending && <FieldError>{formError}</FieldError>}
      </StickyFormActions>
    </form>
  );
}
