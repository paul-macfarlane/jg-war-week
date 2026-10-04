import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getActor } from "@/auth/actor";
import { FinaleSlideshow } from "@/components/finale";
import { finaleSlideData } from "@/lib/finale-slides";
import { getAwards } from "@/queries/awards";
import {
  getFinaleCounts,
  getFinaleSlides,
  getWinners,
} from "@/queries/finale-slides";
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
 * The Finale (closing-ceremony slideshow), for the projector. Any signed-in
 * JG user may open it; its Standings countdown and Winner slides play the
 * same Standings the leaderboard shows, read once here, and every other
 * slide's data is read here too. No AutoRefresh: the slides show what
 * the page loaded; reload for the latest.
 */
export default async function FinalePage({
  params,
}: PageProps<"/[edition]/finale">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const [slides, standings, actor, counts, awards, champions] =
    await Promise.all([
      getFinaleSlides(warWeek.id),
      getStandings(warWeek),
      getActor(),
      getFinaleCounts(warWeek.id),
      getAwards(warWeek),
      getWinners(warWeek),
    ]);

  return (
    <main>
      <FinaleSlideshow
        slides={finaleSlideData(slides, {
          warWeek,
          standings,
          counts,
          awards,
          champions,
        })}
        edition={warWeek.edition}
        storyTheme={warWeek.storyTheme}
        isOrganizer={actor?.isOrganizer ?? false}
      />
    </main>
  );
}
