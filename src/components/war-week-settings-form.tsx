"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { updateWarWeekSettings } from "@/actions/setup";
import { ColorField, type ColorSwatch } from "@/components/color-field";
import { DateRangePicker } from "@/components/date-range-picker";
import { OptionSelect, type SelectOption } from "@/components/option-select";
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
import {
  type AutosaveSnapshot,
  type AutosaveStatus,
  createAutosave,
} from "@/lib/autosave";
import { normalizeHex } from "@/lib/color";
import {
  type OverrideColumn,
  type WarWeekSettingsInput,
  settingsSaveGroup,
} from "@/lib/setup";
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

// The derived palette's labels; its colors and their override columns are
// `theme.ts`'s `OVERRIDE_FIELDS`.
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

/** How long after the last edit a change saves. */
const AUTOSAVE_DELAY_MS = 800;

const STATUS_TEXT: Record<AutosaveStatus, string> = {
  idle: "Changes save automatically",
  saving: "Saving…",
  saved: "Saved",
  failed: "Not saved: see the field marked below",
};

/**
 * The "War Week settings" heading and its form: a War Week's settings,
 * Appearance Theme and closing (Winner and highlights). Status isn't here:
 * Start, End and Reopen change it. The Appearance Theme's five colors are
 * the base palette; the other color scheme's colors are derived from them,
 * and each can be overridden. The two previews (one per scheme) and the
 * contrast warnings update as you type.
 *
 * There is no Save button: each field saves itself `AUTOSAVE_DELAY_MS`
 * after the last edit (`createAutosave`; the date range as one, the
 * background with the overrides: `settingsSaveGroup`), and a status beside
 * the heading says "Saving…" or "Saved". Validation runs on the server; a
 * refused field shows its error under it and keeps the typed value, and
 * every other field still saves.
 *
 * Leaving the page: an in-app navigation (unmount) and the tab going
 * hidden (`visibilitychange`, which also covers a phone switching apps)
 * send a waiting change at once, and the save runs to completion in the
 * still-open app. A reload or close can't promise a request finishes once
 * the page unloads, so `beforeunload` sends what's waiting and asks the
 * browser to warn while a save is waiting, in flight, or refused.
 */
export function WarWeekSettingsForm({
  warWeekId,
  headingId,
  initial,
  dayDates,
  teamSwatches,
}: {
  /** The War Week these settings were rendered for; each save posts it. */
  warWeekId: string;
  /** The heading's id, for the section's `aria-labelledby`. */
  headingId: string;
  initial: WarWeekSettingsInput;
  /** The War Week's existing Day dates, `YYYY-MM-DD`. */
  dayDates: string[];
  /** The War Week's Team colors, offered as color swatches. */
  teamSwatches: ColorSwatch[];
}) {
  const router = useRouter();
  // The values as first rendered: a save's refresh brings new `initial`
  // props, but the light/dark flip below is measured against these.
  const [rendered] = useState(initial);
  const [values, setValues] = useState(initial);
  const initialScheme = backgroundColorScheme(rendered.backgroundColor);

  const [saveState, setSaveState] = useState<AutosaveSnapshot>({
    status: "idle",
    fieldErrors: {},
  });
  const [autosave] = useState(() =>
    createAutosave<WarWeekSettingsInput>({
      saved: initial,
      save: (input) => updateWarWeekSettings(warWeekId, input),
      groupOf: settingsSaveGroup,
      delayMs: AUTOSAVE_DELAY_MS,
      onChange: setSaveState,
      // The header and the Archive show the settings and Appearance Theme.
      onSettled: () => router.refresh(),
    }),
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void autosave.flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      void autosave.flush();
      if (autosave.unsaved()) event.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
      void autosave.flush();
    };
  }, [autosave]);

  /** Applies an edit to `fields` and queues them to save. */
  function edit(
    fields: (keyof WarWeekSettingsInput)[],
    apply: (v: WarWeekSettingsInput) => WarWeekSettingsInput,
  ) {
    const next = apply(values);
    setValues(next);
    autosave.change(next, fields);
  }

  function setValue(field: keyof WarWeekSettingsInput, value: string) {
    edit([field], (v) => {
      const next = { ...v, [field]: value };
      const nextScheme = backgroundColorScheme(value);
      if (
        field !== "backgroundColor" ||
        nextScheme === backgroundColorScheme(v.backgroundColor)
      ) {
        return next;
      }
      // Measured against the background as rendered, not the last edit (a
      // hex typed key by key can pass through the other scheme): away from
      // it the overrides go back to derived, so any set after the flip are
      // kept; back to it, its overrides return. They save with the
      // background (`settingsSaveGroup`).
      return {
        ...next,
        ...(nextScheme === initialScheme
          ? overrideValues(rendered)
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
  // The base background crossed light and dark since the page loaded.
  const flipNotice =
    scheme !== initialScheme
      ? `Changing the background to a ${scheme} one clears the ${other} mode colors (they'll be derived again).`
      : null;

  const fieldErrors = saveState.fieldErrors;

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
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-lg font-semibold">
          War Week settings
        </h2>
        <p
          role="status"
          aria-live="polite"
          data-slot="autosave-status"
          data-status={saveState.status}
          className={
            saveState.status === "failed"
              ? "text-destructive text-sm"
              : "text-foreground/70 text-sm"
          }
        >
          {STATUS_TEXT[saveState.status]}
        </p>
      </div>
      <form
        // Enter in a field saves it now instead of submitting the page.
        onSubmit={(event) => {
          event.preventDefault();
          void autosave.flush();
        }}
        className="flex flex-col gap-6"
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
                  edit(["startDate", "endDate"], (v) => ({
                    ...v,
                    startDate: start,
                    endDate: end,
                  }))
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
            {/* A free-for-all has no Teams: hide the fields; their saved
              values stay (each save sends the saved ones). */}
            {values.mode !== "free-for-all" && (
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
                      {SCHEME_LABEL[other]}{" "}
                      {OVERRIDE_LABEL[color].toLowerCase()} color
                    </FieldLabel>
                    <ColorField
                      id={`settings-${field}`}
                      aria-invalid={!!fieldErrors[field]}
                      value={derived[color]}
                      swatches={swatches}
                      onValueChange={(hex) => setOverride(color, field, hex)}
                    />
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
      </form>
    </>
  );
}
