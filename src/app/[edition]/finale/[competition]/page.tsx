import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BracketFinale } from "@/components/bracket-finale";
import { bracketFinaleRows } from "@/lib/bracket/finale";
import { finalPlacings } from "@/lib/bracket/formats";

import { getBracketFinalePage } from "./bracket-finale";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[edition]/finale/[competition]">): Promise<Metadata> {
  const { edition, competition } = await params;
  const found = await getBracketFinalePage(edition, competition);
  const name = found ? `${found.view.competition.name} ` : "";
  return { title: `${name}Finale · War Week ${edition.toUpperCase()}` };
}

/**
 * The Bracket Finale, for the projector: a finalized Bracket's placings
 * count in from last place to first and end on the champion. Any signed-in
 * JG user may open it. No AutoRefresh: it plays what the page loaded.
 */
export default async function BracketFinalePage({
  params,
}: PageProps<"/[edition]/finale/[competition]">) {
  const { edition, competition } = await params;
  // The layout already answered 404 for anything else, above `loading.tsx`.
  const found = await getBracketFinalePage(edition, competition);
  if (!found) notFound();
  const { warWeek, view } = found;
  const rows = bracketFinaleRows(
    finalPlacings(view.bracket, view.entrants),
    view.entrants,
  );

  return (
    <main>
      <BracketFinale
        rows={rows}
        competitionName={view.competition.name}
        edition={warWeek.edition}
        storyTheme={warWeek.storyTheme}
        scoring={view.competition.scoring}
        primaryColor={warWeek.primaryColor}
      />
    </main>
  );
}
