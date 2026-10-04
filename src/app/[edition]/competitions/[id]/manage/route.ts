import { redirect } from "next/navigation";

import { getActor, setAdminEditionCookie } from "@/auth/actor";
import { can } from "@/lib/access";
import { competitionPageHref } from "@/lib/competitions";
import { getCurrentWarWeek } from "@/queries/war-weeks";

import { getCompetitionPage } from "../competition";

/**
 * "Manage" on a Competition's page (spec R20, decision 9): switches the
 * admin edition to the Competition's own War Week, when the viewer may
 * view it in `/admin`, then opens its admin page. `/admin` shows one War
 * Week at a time (the `admin_edition` cookie), so without the switch a
 * Competition of another War Week would not be found there. The admin
 * page still runs its own gate.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/[edition]/competitions/[id]/manage">,
) {
  const { edition, id } = await params;
  const found = await getCompetitionPage(edition, id);
  if (!found) return new Response("Not found", { status: 404 });
  const { warWeek, competition } = found;
  const actor = await getActor();
  if (can(actor, "admin.view", { warWeekId: warWeek.id }) === null) {
    const current = await getCurrentWarWeek();
    await setAdminEditionCookie(warWeek.edition, warWeek.id === current?.id);
  }
  redirect(competitionPageHref(competition.id));
}
