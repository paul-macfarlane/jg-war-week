import { permanentRedirect } from "next/navigation";

import { competitionPageHref } from "@/lib/competitions";

/** Retired (ticket 101): Record placements is on the Competition's one admin page. */
export default async function RetiredPlacementSheetPage({
  params,
}: PageProps<"/admin/placements/[competitionId]">) {
  const { competitionId } = await params;
  permanentRedirect(competitionPageHref(competitionId));
}
