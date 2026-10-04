import { cookies } from "next/headers";
import { cache } from "react";

import { getSessionEmail } from "@/auth/server";
import type { WarWeek } from "@/db/schema";
import { type Actor, can, defaultAdminWarWeek } from "@/lib/access";
import { getHostedCompetitions, isOrganizerEmail } from "@/queries/organizers";

/** The cookie the admin edition switcher sets (see `selectAdminEdition`). */
export const ADMIN_EDITION_COOKIE = "admin_edition";

/**
 * Remembers which War Week `/admin` shows: the edition, or no cookie when
 * it's the current War Week (the default). Callers check `admin.view` first.
 */
export async function setAdminEditionCookie(
  edition: string,
  isCurrent: boolean,
) {
  const jar = await cookies();
  if (isCurrent) {
    jar.delete(ADMIN_EDITION_COOKIE);
    return;
  }
  jar.set(ADMIN_EDITION_COOKIE, edition, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Who is asking, for `can`: null when anonymous, otherwise the session
 * email, whether it's an Organizer and the Competitions it hosts. Memoized
 * per request only, so access always follows the current assignment.
 */
export const getActor = cache(async (): Promise<Actor> => {
  const email = await getSessionEmail();
  if (!email) return null;
  const [isOrganizer, hosts] = await Promise.all([
    isOrganizerEmail(email),
    getHostedCompetitions(email),
  ]);
  return { email, isOrganizer, hosts };
});

/**
 * The War Week `/admin` shows: the edition in the `admin_edition` cookie
 * when the actor may view it, otherwise `defaultAdminWarWeek`. Only the
 * admin pages read the cookie; no action takes its write target from it
 * (ADR 0003).
 */
export async function getAdminWarWeek(
  actor: Actor,
  warWeeks: WarWeek[],
  current: WarWeek,
): Promise<WarWeek> {
  const edition = (await cookies()).get(ADMIN_EDITION_COOKIE)?.value;
  const selected = edition
    ? warWeeks.find((w) => w.edition === edition)
    : undefined;
  if (
    selected &&
    can(actor, "admin.view", { warWeekId: selected.id }) === null
  ) {
    return selected;
  }
  return defaultAdminWarWeek(actor, warWeeks, current);
}
