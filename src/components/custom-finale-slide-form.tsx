"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import {
  createCustomFinaleSlide,
  updateCustomFinaleSlide,
} from "@/actions/finale-slides";
import { ColorField, type ColorSwatch } from "@/components/color-field";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
} from "@/components/setup-row";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FINALE_SLIDE_HEADING_MAX } from "@/lib/finale-slides";
import type { WriteResult } from "@/lib/result";
import type { Content } from "@/lib/rich-text/content";

const EMPTY_BODY: Content = { type: "doc", content: [] };

/**
 * Add or edit a Custom Finale slide, in its Sheet on admin → Finale: a
 * heading, a rich-text body (images and video by URL, as the editor does)
 * and an optional background color. `onSaved` closes the Sheet.
 */
export function CustomFinaleSlideForm({
  warWeekId,
  slideId,
  initial,
  themeSwatches,
  onSaved,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Set when editing an existing Custom slide. */
  slideId?: string;
  initial?: {
    heading: string;
    body: Content;
    backgroundColor: string | null;
  };
  /** The theme's colors, as the background's swatches. */
  themeSwatches: ColorSwatch[];
  onSaved?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [heading, setHeading] = useState(initial?.heading ?? "");
  const [body, setBody] = useState<Content>(initial?.body ?? EMPTY_BODY);
  const [background, setBackground] = useState<string | null>(
    initial?.backgroundColor ?? null,
  );

  // Validation runs on the server; a refusal names its fields. Every field
  // is closed over from state so the rich-text body survives a refusal.
  const [result, formAction, pending] = useActionState(
    async (): Promise<WriteResult> => {
      const input = { heading, body, backgroundColor: background };
      const saved = slideId
        ? await updateCustomFinaleSlide(slideId, input)
        : await createCustomFinaleSlide(warWeekId, input);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success("Custom slide saved");
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
      aria-label="Custom slide"
    >
      <FieldGroup className="px-4">
        <Field data-invalid={!!fieldErrors.heading}>
          <FieldLabel htmlFor="custom-slide-heading">Heading</FieldLabel>
          <Input
            id="custom-slide-heading"
            name="heading"
            required
            maxLength={FINALE_SLIDE_HEADING_MAX}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.heading}
            value={heading}
            onChange={(event) => setHeading(event.target.value)}
          />
          <FieldError>{fieldErrors.heading}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.body}>
          <FieldTitle id="custom-slide-body-label">Body</FieldTitle>
          <RichTextEditor
            content={body}
            onChange={setBody}
            label="Body"
            labelId="custom-slide-body-label"
            placeholder="Write what the slide says…"
          />
          <FieldError>{fieldErrors.body}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.backgroundColor}>
          <FieldTitle id="custom-slide-background-label">Background</FieldTitle>
          {background === null ? (
            <>
              <FieldDescription>
                The theme&apos;s background. Pick a color to paint this slide
                instead.
              </FieldDescription>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 sm:min-h-9"
                  onClick={() =>
                    setBackground(themeSwatches[0]?.color ?? "#1e3a5f")
                  }
                >
                  Choose a background color
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <ColorField
                value={background}
                onValueChange={setBackground}
                swatches={themeSwatches}
                aria-label="Background color"
                aria-invalid={!!fieldErrors.backgroundColor}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:min-h-9"
                onClick={() => setBackground(null)}
              >
                Use the theme background
              </Button>
            </div>
          )}
          <FieldError>{fieldErrors.backgroundColor}</FieldError>
        </Field>
      </FieldGroup>

      <SetupSheetFooter>
        <SetupSaveButton
          pending={pending}
          label={slideId ? "Save" : "Add custom slide"}
        />
        <SetupRowError error={pending ? null : formError} />
      </SetupSheetFooter>
    </form>
  );
}
