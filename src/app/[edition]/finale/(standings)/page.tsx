import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Finale } from "@/components/finale";
import { getStandings } from "@/queries/standings";

import { getWarWeekForEdition } from "../../war-week";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[edition]/finale">): Promise<Metadata> {
  const { edition } = await params;
  return { title: `Finale · War Week ${edition.toUpperCase()}` };
}

/**
 * The Finale (closing-ceremony screen), for the projector. Any signed-in JG
 * user may open it; it plays the same Standings the leaderboard shows.
 * No AutoRefresh: the countdown plays what the page loaded; reload for the
 * latest Standings.
 */
export default async function FinalePage({
  params,
}: PageProps<"/[edition]/finale">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const standings = await getStandings(warWeek);

  return (
    <main>
      <Finale
        standings={standings}
        edition={warWeek.edition}
        storyTheme={warWeek.storyTheme}
        teamLabel={warWeek.teamLabel}
        primaryColor={warWeek.primaryColor}
      />
    </main>
  );
}
