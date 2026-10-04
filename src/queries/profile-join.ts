import { type SQL, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn, PgSelect } from "drizzle-orm/pg-core";

import { type DBOrTx, db } from "@/db";
import { participant, profile, user } from "@/db/schema";
import {
  GOOGLE_PHOTO_PREFIX,
  type ProfilesByEmail,
  profilesByEmail,
} from "@/lib/profile";

/** A Participant table, or an alias of it: what the joins key on. */
type ParticipantColumns = { email: AnyPgColumn; displayName: AnyPgColumn };

/**
 * The SQL form of the name and picture resolver (`resolveProfile`): left
 * joins `profile` and `user` on the Participant's email, lowercased
 * (better-auth stores lowercase emails, so the `user` join uses its unique
 * index and matches at most one row). Takes a `$dynamic()` select; select
 * `participantNameSql` and `participantImageSql` alongside.
 */
export function withProfile<T extends PgSelect>(
  query: T,
  participantTable: ParticipantColumns = participant,
) {
  return query
    .leftJoin(profile, profileOn(participantTable))
    .leftJoin(user, eq(user.email, sql`lower(${participantTable.email})`));
}

/** The `profile` join condition: the Participant's email, lowercased. */
export function profileOn(
  participantTable: Pick<ParticipantColumns, "email"> = participant,
): SQL {
  return eq(profile.email, sql`lower(${participantTable.email})`);
}

/** The Participant's shown name: the Profile name, else the roster name. */
export function participantNameSql(
  participantTable: ParticipantColumns = participant,
): SQL<string> {
  return sql<string>`coalesce(${profile.name}, ${participantTable.displayName})`;
}

/**
 * The Participant's picture: the Profile picture URL, else the Google photo
 * (`user.image` only when it is one), else null (initials).
 */
export function participantImageSql(): SQL<string | null> {
  return sql<
    string | null
  >`coalesce(${profile.imageUrl}, case when ${user.image} like ${`${GOOGLE_PHOTO_PREFIX}%`} then ${user.image} end)`;
}

/**
 * For the email-keyed callers (the account menu, Announcement authors): each email's Profile name and picture URL and its Google photo,
 * by lowercase email. Resolve with `resolveProfileForEmail`.
 */
export async function getProfilesByEmail(
  emails: string[],
  dbOrTx: DBOrTx = db,
): Promise<ProfilesByEmail> {
  const keys = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
  if (keys.length === 0) return new Map();
  const [profiles, users] = await Promise.all([
    dbOrTx
      .select({
        email: profile.email,
        profileName: profile.name,
        profileImage: profile.imageUrl,
      })
      .from(profile)
      .where(inArray(profile.email, keys)),
    dbOrTx
      .select({ email: user.email, googleImage: user.image })
      .from(user)
      .where(inArray(user.email, keys)),
  ]);
  return profilesByEmail([...profiles, ...users]);
}
