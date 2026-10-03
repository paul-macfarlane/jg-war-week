"use client";

import { type CSSProperties, useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import { saveProfile } from "@/actions/profile";
import { Avatar } from "@/components/avatar";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { ThemeRoot } from "@/components/theme-root";
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
  PROFILE_IMAGE_URL_MAX,
  PROFILE_NAME_MAX,
  isProfileImageUrl,
  resolveProfile,
} from "@/lib/profile";
import type { WriteResult } from "@/lib/result";

const PREVIEWS = [
  { scheme: "light", label: "Light" },
  { scheme: "dark", label: "Dark" },
] as const;

/**
 * The Profile form: a Profile name and a picture URL, with a live preview
 * of the Avatar on the War Week's light and dark surfaces, so a
 * transparent or dark-on-dark picture is caught before it's saved. Empty
 * fields mean the roster name (else the email's local part) and the
 * Google photo (else initials).
 */
export function ProfileForm({
  fallbackName,
  hint,
  profileName,
  profileImage,
  googleImage,
  primaryColor,
  themeStyle,
}: {
  /** The roster name, else the email's local part. */
  fallbackName: string;
  /** "Shown as …" under the name field. */
  hint: string;
  profileName: string | null;
  profileImage: string | null;
  googleImage: string | null;
  primaryColor: string;
  /** The War Week's `warWeekThemeStyle`, for the previews. */
  themeStyle: CSSProperties;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(profileName ?? "");
  const [imageUrl, setImageUrl] = useState(profileImage ?? "");
  const [result, formAction, pending] = useActionState(
    async (
      _previous: WriteResult | null,
      formData: FormData,
    ): Promise<WriteResult> => {
      const saved = await saveProfile({
        name: String(formData.get("name") ?? ""),
        imageUrl: String(formData.get("imageUrl") ?? ""),
      });
      if (saved.ok) toast.success("Profile saved");
      else toast.error(saved.error);
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);

  // A URL that wouldn't save previews as what an empty field shows.
  const typedUrl = imageUrl.trim();
  const preview = resolveProfile({
    rosterName: fallbackName,
    profileName: name.trim() || null,
    profileImage: isProfileImageUrl(typedUrl) ? typedUrl : null,
    googleImage,
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label="Profile"
      className="flex flex-col gap-6"
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!fieldErrors.name}>
          <FieldLabel htmlFor="profile-name">Profile name</FieldLabel>
          <Input
            id="profile-name"
            name="name"
            autoComplete="name"
            className="h-11 sm:h-9"
            maxLength={PROFILE_NAME_MAX}
            value={name}
            aria-invalid={!!fieldErrors.name}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldDescription>{hint}</FieldDescription>
          <FieldError>{fieldErrors.name}</FieldError>
        </Field>
        <Field data-invalid={!!fieldErrors.imageUrl}>
          <FieldLabel htmlFor="profile-image-url">Picture URL</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Input
              id="profile-image-url"
              name="imageUrl"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://…"
              className="h-11 min-w-0 flex-1 basis-60 sm:h-9"
              maxLength={PROFILE_IMAGE_URL_MAX}
              value={imageUrl}
              aria-invalid={!!fieldErrors.imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              disabled={imageUrl === ""}
              onClick={() => setImageUrl("")}
            >
              Use Google photo
            </Button>
          </div>
          <FieldDescription>
            Leave empty to use your Google photo.
          </FieldDescription>
          <FieldError>{fieldErrors.imageUrl}</FieldError>
        </Field>
      </FieldGroup>

      <div className="grid grid-cols-2 gap-4">
        {PREVIEWS.map(({ scheme, label }) => (
          <ThemeRoot
            key={scheme}
            scheme={scheme}
            style={themeStyle}
            className="bg-background text-foreground border-border rounded-lg border p-4 font-sans"
          >
            <figure
              aria-label={`${label} preview`}
              className="flex flex-col items-center gap-2"
            >
              <Avatar
                name={preview.name}
                image={preview.image}
                teamColor={null}
                primaryColor={primaryColor}
                className="size-16"
              />
              <figcaption className="flex flex-col items-center gap-0.5 text-center">
                <span className="text-sm font-medium break-all">
                  {preview.name}
                </span>
                <span className="text-foreground/60 text-xs font-medium tracking-wide uppercase">
                  {label}
                </span>
              </figcaption>
            </figure>
          </ThemeRoot>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          className="min-h-11 self-start sm:min-h-9"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        {formError && !pending && <FieldError>{formError}</FieldError>}
      </div>
    </form>
  );
}
