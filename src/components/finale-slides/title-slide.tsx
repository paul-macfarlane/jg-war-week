import type { FinaleSlideProps } from "./types";

/**
 * The Title slide: War Week, its edition and year, and its Story Theme,
 * with the War Week's logo, over its banner when it has them.
 */
export function TitleSlide({ data }: FinaleSlideProps<"title">) {
  const edition = data.edition.toUpperCase();
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-[3vh] overflow-hidden px-[6vw] text-center">
      {data.bannerUrl ? (
        <>
          <img
            src={data.bannerUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div
            aria-hidden
            className="from-background/40 via-background/70 to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
          />
        </>
      ) : null}
      {data.logoUrl ? (
        <img
          src={data.logoUrl}
          alt={`War Week ${edition} logo`}
          className="relative size-[clamp(4rem,16vh,11rem)] rounded-2xl object-contain"
        />
      ) : null}
      <p className="text-primary-text relative text-[clamp(0.875rem,1.8vw,1.75rem)] font-semibold tracking-[0.3em] uppercase">
        War Week · {data.year}
      </p>
      <h1 className="relative text-[clamp(2.75rem,10vw,10rem)] leading-[0.95] font-black tracking-tight break-words">
        War Week {edition}
      </h1>
      <p className="text-primary-text relative max-w-[90vw] text-[clamp(1.5rem,4.5vw,4.5rem)] leading-tight font-semibold break-words">
        {data.storyTheme}
      </p>
    </div>
  );
}
