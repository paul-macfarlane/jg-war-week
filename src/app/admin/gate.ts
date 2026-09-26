import { notFound, redirect } from "next/navigation";

import { getActor, getAdminWarWeek } from "@/auth/actor";
import { getSessionEmail } from "@/auth/server";
import { adminEditions, can } from "@/lib/access";
import { getWarWeeks, selectCurrentWarWeek } from "@/queries/war-weeks";

/**
 * Who an admin page is for: every page an Organizer or a Host of the shown
 * War Week may open, or Organizers only (settings, Days, Teams, FAQ,
 * Awards, the Organizer list, Create next War Week).
 */
export type AdminPageAccess = "organizers-and-hosts" | "organizers";

/**
 * The `/admin` gate. Every admin page calls this first: anonymous users go
 * to sign-in and come back to `returnTo`; the caller renders the refusal
 * ("Organizers and Hosts only") when `allowed` is false. The War Week shown
 * is the one picked in the edition switcher (the `admin_edition` cookie)
 * when the actor may view it, otherwise `defaultAdminWarWeek`. Then
 * `can(actor, "admin.view", …)` decides, and an Organizer-only page also
 * needs an Organizer.
 */
export async function loadAdminPage(
  returnTo: string,
  access: AdminPageAccess = "organizers-and-hosts",
) {
  const warWeeks = await getWarWeeks();
  const current = selectCurrentWarWeek(warWeeks);
  if (!current) notFound();

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/sign-in?callbackURL=${encodeURIComponent(returnTo)}`);
  }

  const actor = await getActor();
  const warWeek = await getAdminWarWeek(actor, warWeeks, current);
  const canView = can(actor, "admin.view", { warWeekId: warWeek.id }) === null;
  const isOrganizer = actor?.isOrganizer ?? false;
  const allowed = canView && (access === "organizers-and-hosts" || isOrganizer);
  const editions = canView ? adminEditions(actor, warWeeks, current) : [];
  const hosted = new Set(
    (actor?.hosts ?? [])
      .filter((h) => h.warWeekId === warWeek.id)
      .map((h) => h.competitionId),
  );
  /** Whether the actor runs a Competition here: an Organizer, or its Host. */
  const runs = (competitionId: string | null | undefined) =>
    isOrganizer || (competitionId != null && hosted.has(competitionId));

  return { warWeek, email, actor, isOrganizer, allowed, editions, runs };
}
