import { permanentRedirect } from "next/navigation";

import { competitionPageHref } from "@/lib/competitions";

/** Retired (ticket 101): the Competition's one admin page holds this now. */
export default async function RetiredParticipationPage({
  params,
}: PageProps<"/admin/competitions/[id]/participation">) {
  const { id } = await params;
  permanentRedirect(competitionPageHref(id));
}
