import { asc, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { finaleSlide } from "@/db/schema";
import { customSlideColors } from "@/lib/custom-finale-slide";
import {
  type FinaleSlideData,
  type ResolvedFinaleSlide,
  resolveFinaleSlides,
  visibleFinaleSlides,
} from "@/lib/finale-slides";
import type { Standings } from "@/lib/standings";

/** A War Week's saved `finale_slide` rows, in no particular order. */
export async function getFinaleSlideRows(warWeekId: string, dbOrTx: DBOrTx) {
  return dbOrTx
    .select({
      id: finaleSlide.id,
      kind: finaleSlide.kind,
      sortOrder: finaleSlide.sortOrder,
      hidden: finaleSlide.hidden,
      heading: finaleSlide.heading,
      body: finaleSlide.body,
      backgroundColor: finaleSlide.backgroundColor,
    })
    .from(finaleSlide)
    .where(eq(finaleSlide.warWeekId, warWeekId))
    .orderBy(asc(finaleSlide.sortOrder), asc(finaleSlide.id));
}

/**
 * A War Week's Finale slide list, hidden slides included: its saved order,
 * or the default order when nothing is saved (`resolveFinaleSlides`).
 */
export async function getFinaleSlides(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<ResolvedFinaleSlide[]> {
  return resolveFinaleSlides(await getFinaleSlideRows(warWeekId, dbOrTx));
}

/**
 * Each visible slide's data, in order, for the slideshow. The Standings
 * countdown gets the page's one `getStandings` result, so the Finale never
 * recomputes Standings.
 */
export function finaleSlideData(
  slides: ResolvedFinaleSlide[],
  context: {
    standings: Standings;
    teamLabel: string;
    primaryColor: string;
    /** The theme's text color, where a Custom slide's text starts from. */
    foregroundColor: string;
  },
): FinaleSlideData[] {
  return visibleFinaleSlides(slides).map((slide): FinaleSlideData => {
    const base = { key: slide.key, name: slide.name };
    switch (slide.kind) {
      case "standings":
        return {
          ...base,
          kind: "standings",
          standings: context.standings,
          teamLabel: context.teamLabel,
          primaryColor: context.primaryColor,
        };
      case "custom":
        return {
          ...base,
          kind: "custom",
          heading: slide.heading ?? slide.name,
          body: slide.body,
          backgroundColor: slide.backgroundColor,
          colors: slide.backgroundColor
            ? customSlideColors(slide.backgroundColor, {
                foreground: context.foregroundColor,
                primary: context.primaryColor,
              })
            : null,
        };
      default:
        return { ...base, kind: slide.kind };
    }
  });
}
