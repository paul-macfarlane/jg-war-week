import { AboutStill } from "@/components/about-still";
import { ABOUT_FEATURES } from "@/lib/about";

/**
 * The About page's "What it does" features (ticket 28), one per row and one
 * per `ABOUT_FEATURES` entry. The still fills the content column, with its
 * caption beside it from `md` up and below it on a phone, so the still is big
 * enough to read. Each still is the one
 * `scripts/about-media.ts` wrote into `public/about/<slug>.png` (and
 * `<slug>-dark.png` for a dark Display) from the seeded demo: no
 * hand-captured screenshot anywhere on the page.
 */
export function AboutFeatureGrid() {
  return (
    <ul className="flex list-none flex-col gap-8 p-0" aria-label="Features">
      {ABOUT_FEATURES.map((feature, index) => (
        <li
          key={feature.slug}
          className="border-border bg-background/60 grid grid-cols-1 items-start gap-5 overflow-hidden rounded-xl border p-3 sm:p-4 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] md:gap-8"
          data-feature={feature.slug}
        >
          <AboutStill
            className="border-border aspect-video w-full rounded-lg border object-cover object-top"
            name={feature.slug}
            width={2560}
            height={1440}
            sizes="(min-width: 1152px) 760px, (min-width: 768px) 65vw, 100vw"
            alt={feature.alt}
          />
          <div className="flex flex-col gap-2 p-2 md:p-0 md:pr-4">
            <h3 className="font-semibold">
              <span className="text-primary mr-2 tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              {feature.title}
            </h3>
            <p className="text-foreground/70 text-sm leading-relaxed">
              {feature.text}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
