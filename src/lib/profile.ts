import { z } from "zod";

import { nameFromEmail } from "@/lib/account";

/**
 * The only `user.image` shown as a picture: a Google photo, which
 * better-auth stores at sign-in. Anything else there is ignored (ADR 0007).
 */
export const GOOGLE_PHOTO_PREFIX = "https://lh3.googleusercontent.com/";

/** The longest Profile name: the roster-name limit. */
export const PROFILE_NAME_MAX = 120;
/** The longest picture URL. */
export const PROFILE_IMAGE_URL_MAX = 2048;

/** What is stored for one email: its Profile and its Google photo. */
export type ProfileFacts = {
  profileName: string | null;
  profileImage: string | null;
  googleImage: string | null;
};

/** The name and picture shown for a person; null picture means initials. */
export type ResolvedProfile = { name: string; image: string | null };

/** Lowercase email to what is stored for it (`profilesByEmail`). */
export type ProfilesByEmail = Map<string, ProfileFacts>;

/** `value` when it is a Google photo URL (`GOOGLE_PHOTO_PREFIX`), else null. */
export function googlePhotoOf(value: string | null | undefined): string | null {
  return value?.startsWith(GOOGLE_PHOTO_PREFIX) ? value : null;
}

/**
 * The one name and picture rule: the Profile name, else the roster name;
 * the Profile picture URL, else the Google photo, else null (initials).
 * The SQL form is `participantNameSql` / `participantImageSql`.
 */
export function resolveProfile({
  rosterName,
  profileName,
  profileImage,
  googleImage,
}: { rosterName: string } & Partial<ProfileFacts>): ResolvedProfile {
  return {
    name: profileName || rosterName,
    image: profileImage || googlePhotoOf(googleImage),
  };
}

/**
 * Builds the lowercase-email map the email-keyed callers resolve with. A
 * row may carry only the Profile or only the Google photo; rows for the
 * same email, in any case, merge.
 */
export function profilesByEmail(
  rows: ({ email: string } & Partial<ProfileFacts>)[],
): ProfilesByEmail {
  const map: ProfilesByEmail = new Map();
  for (const { email, ...facts } of rows) {
    const key = email.trim().toLowerCase();
    const known = map.get(key) ?? {
      profileName: null,
      profileImage: null,
      googleImage: null,
    };
    map.set(key, {
      profileName: facts.profileName ?? known.profileName,
      profileImage: facts.profileImage ?? known.profileImage,
      googleImage: facts.googleImage ?? known.googleImage,
    });
  }
  return map;
}

/**
 * `resolveProfile` for a caller that knows the email: the Profile name,
 * else `rosterName`, else the email's local part (`nameFromEmail`).
 */
export function resolveProfileForEmail(
  email: string,
  profiles: ProfilesByEmail,
  rosterName?: string | null,
): ResolvedProfile {
  return resolveProfile({
    rosterName: rosterName || nameFromEmail(email),
    ...profiles.get(email.trim().toLowerCase()),
  });
}

/** Whether `value` parses as a URL with protocol `https:` and a host. */
export function isProfileImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}

/** A trimmed optional text field, missing or empty as "". */
const trimmed = z
  .string()
  .nullish()
  .transform((value) => value?.trim() ?? "");

/**
 * The Profile form: both fields optional and trimmed, empty as null. The
 * picture URL must be `https:` with a host, so never `http:`, `data:`,
 * `javascript:` or a relative path. The app never fetches it.
 */
export const profileSchema = z.object({
  name: trimmed
    .pipe(
      z
        .string()
        .max(
          PROFILE_NAME_MAX,
          `must be ${PROFILE_NAME_MAX} characters or fewer`,
        ),
    )
    .transform((value) => value || null),
  imageUrl: trimmed
    .pipe(
      z
        .string()
        .max(
          PROFILE_IMAGE_URL_MAX,
          `must be ${PROFILE_IMAGE_URL_MAX} characters or fewer`,
        )
        .refine(
          (value) => value === "" || isProfileImageUrl(value),
          "must be an https:// link to an image",
        ),
    )
    .transform((value) => value || null),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type ProfileValues = z.output<typeof profileSchema>;
