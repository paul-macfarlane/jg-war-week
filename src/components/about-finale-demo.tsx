import { AboutStill } from "@/components/about-still";

/**
 * A still of the current War Week's Finale on a phone (ticket 04): its
 * Title slide, the first of the slideshow (it shows no Standings). Shown
 * below the features as a plain still, not a looping video. `public/about/finale-poster.png` (and `finale-poster-dark.png`
 * for a dark Display) is written by `scripts/about-media.ts` from the seeded
 * demo, never by hand.
 */
const DESCRIPTION =
  "The current War Week's Finale on a phone, opening on its Title slide.";

export function AboutFinaleDemo() {
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="border-foreground/20 bg-background w-56 overflow-hidden rounded-[2.25rem] border-8 shadow-[0_0_80px_-20px_var(--primary)] sm:w-64">
        <div className="bg-background aspect-[390/844] w-full">
          <AboutStill
            className="h-full w-full object-cover"
            name="finale-poster"
            width={780}
            height={1688}
            alt={DESCRIPTION}
          />
        </div>
      </div>
      <figcaption className="text-foreground/60 max-w-xs text-center text-xs">
        The Finale: a slideshow for closing ceremonies, from the Title slide to
        the Standings counting in from last place to first.
      </figcaption>
    </figure>
  );
}
