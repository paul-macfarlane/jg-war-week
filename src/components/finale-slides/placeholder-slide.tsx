import type { ReactNode } from "react";

/** The eyebrow over a slide's heading: "War Week XI · The Matrix". */
export function SlideEyebrow({
  edition,
  storyTheme,
}: {
  edition: string;
  storyTheme: string;
}) {
  return (
    <p className="text-primary text-[clamp(0.75rem,1.4vw,1.25rem)] font-semibold tracking-[0.25em] uppercase">
      War Week {edition.toUpperCase()} · {storyTheme}
    </p>
  );
}

/**
 * A slide still to be built (tickets 73 and 74): its name, big, under the
 * War Week's eyebrow.
 */
export function PlaceholderSlide({
  name,
  edition,
  storyTheme,
  children,
}: {
  name: string;
  edition: string;
  storyTheme: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[2vh] px-[5vw] text-center">
      <SlideEyebrow edition={edition} storyTheme={storyTheme} />
      <h1 className="text-[clamp(2.5rem,7vw,7rem)] leading-tight font-bold tracking-tight break-words">
        {name}
      </h1>
      {children}
    </div>
  );
}
