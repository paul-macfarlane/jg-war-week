import { ABOUT_FEATURES } from "@/lib/about";

/**
 * The About page's feature cards (ticket 28), one per `ABOUT_FEATURES`
 * entry. Each shows the still that
 * `scripts/about-media.ts` wrote into `public/about/<slug>.png` from the
 * seeded demo: no hand-captured screenshot anywhere on the page.
 */
export function AboutFeatureGrid() {
  return (
    <ul
      className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Features"
    >
      {ABOUT_FEATURES.map((feature, index) => (
        <li
          key={feature.slug}
          className="border-border bg-background/60 flex flex-col overflow-hidden rounded-xl border"
          data-feature={feature.slug}
        >
          <img
            className="border-border aspect-video w-full border-b object-cover object-top"
            src={`/about/${feature.slug}.png`}
            width={1280}
            height={720}
            alt={feature.alt}
            loading="lazy"
          />
          <div className="flex flex-col gap-2 p-5">
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
