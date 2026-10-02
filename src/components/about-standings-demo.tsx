/**
 * The About page's hero (ticket 04): a Participant favorite, Standings
 * moving after a Points Entry, shown as three stills captured by
 * `scripts/about-media.ts` — before the entry, the Organizer saving it, and
 * the Standings reordered after — presented as a small before → after
 * stepper rather than a video. All three are written to
 * `public/about/standings-<step>.png` from the seeded demo, never by hand.
 */
const STEPS = [
  {
    slug: "standings-before",
    label: "Before",
    alt: "Home Standings before an Organizer records a Points Entry.",
  },
  {
    slug: "standings-entry",
    label: "Points Entry",
    alt: "An Organizer saving a Points Entry for whoever is in last place.",
  },
  {
    slug: "standings-after",
    label: "After",
    alt: "The same home Standings, reordered right after the Points Entry saves.",
  },
] as const;

export function AboutStandingsDemo() {
  return (
    <figure className="flex flex-col items-center gap-3">
      <ol className="flex list-none items-center gap-2 p-0 sm:gap-3">
        {STEPS.map((step, index) => (
          <li key={step.slug} className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <div className="border-foreground/20 bg-background w-[min(6rem,26vw)] overflow-hidden rounded-2xl border-4 shadow-[0_0_40px_-15px_var(--primary)] sm:w-32">
                <img
                  className="aspect-[390/844] w-full object-cover"
                  src={`/about/${step.slug}.png`}
                  width={390}
                  height={844}
                  alt={step.alt}
                  data-standings-step={step.slug}
                />
              </div>
              <span className="text-foreground/60 text-xs font-medium">
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <span aria-hidden className="text-foreground/40 text-xl">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
      <figcaption className="text-foreground/60 max-w-xs text-center text-xs">
        An Organizer records a Points Entry and the home Standings reorder, on
        the spot.
      </figcaption>
    </figure>
  );
}
