/**
 * A still of the current War Week's Finale on a phone (ticket 04): the countdown
 * caught mid-count, Standings climbing into place. Moved out of the About
 * page's hero (now `AboutStandingsDemo`) and shown lower down as a plain
 * still, not a looping video. `public/about/finale-poster.png` is written
 * by `scripts/about-media.ts` from the seeded demo, never by hand.
 */
const DESCRIPTION =
  "War Week XII's Finale on a phone, ready to count the Standings in from last place to first.";

export function AboutFinaleDemo() {
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="border-foreground/20 bg-background w-56 overflow-hidden rounded-[2.25rem] border-8 shadow-[0_0_80px_-20px_var(--primary)] sm:w-64">
        <div className="bg-background aspect-[390/844] w-full">
          <img
            className="h-full w-full object-cover"
            src="/about/finale-poster.png"
            width={780}
            height={1688}
            alt={DESCRIPTION}
          />
        </div>
      </div>
      <figcaption className="text-foreground/60 max-w-xs text-center text-xs">
        The Finale: at closing ceremonies, Standings count in from last place to
        first.
      </figcaption>
    </figure>
  );
}
