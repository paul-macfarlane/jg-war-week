import { SlideEyebrow } from "./slide-eyebrow";
import type { FinaleSlideProps } from "./types";

/**
 * The By the numbers slide: the War Week's non-zero figures (Competitions
 * run, Matches and Attempts logged, Bracket Matches played, Points Entries, Points handed out,
 * Participants), each big over its label.
 */
export function NumbersSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"numbers">) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[6vh] px-[5vw] py-[8vh] text-center">
      <header className="flex flex-col items-center gap-[1.5vh]">
        <SlideEyebrow edition={edition} storyTheme={storyTheme} />
        <h1 className="text-[clamp(2.25rem,5.5vw,5.5rem)] leading-tight font-bold tracking-tight">
          {data.name}
        </h1>
      </header>
      <dl className="grid w-full max-w-[min(96rem,92vw)] grid-cols-2 gap-x-[4vw] gap-y-[5vh] md:grid-cols-3">
        {data.figures.map((figure) => (
          <div
            key={figure.label}
            className="flex flex-col-reverse items-center gap-[1vh]"
          >
            <dt className="text-foreground/75 text-[clamp(0.875rem,1.7vw,1.875rem)] font-medium tracking-wide uppercase">
              {figure.label}
            </dt>
            <dd className="text-primary-text text-[clamp(2.25rem,7.5vw,8.5rem)] leading-none font-black tabular-nums">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
