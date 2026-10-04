import { permanentRedirect } from "next/navigation";

import { competitionPageHref } from "@/lib/competitions";

/**
 * Retired (ticket 101): a Bracket's results are on its Competition's one
 * admin page. A Bracket's id is its Competition's.
 */
export default async function RetiredBracketResultsPage({
  params,
}: PageProps<"/admin/brackets/[id]">) {
  const { id } = await params;
  permanentRedirect(competitionPageHref(id));
}
