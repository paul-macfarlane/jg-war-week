import { RichText } from "@/components/rich-text";

import type { FinaleSlideProps } from "./types";

/**
 * A Custom slide: the Organizer's heading at projector scale and their
 * rich-text body (re-sanitized by `RichText`, never raw HTML). A background
 * color paints the whole stage (`FinaleSlideshow`), whose text colors are
 * overridden to read on it; links here use the `--link` override. The body
 * scrolls inside the slide only when it's taller than the screen.
 */
export function CustomSlide({ data }: FinaleSlideProps<"custom">) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[3vh] px-[5vw] py-[6vh] text-center">
      <h1 className="text-[clamp(2.5rem,7vw,7rem)] leading-tight font-bold tracking-tight break-words">
        {data.heading}
      </h1>
      <div
        role="region"
        aria-label={`${data.heading}: details`}
        tabIndex={0}
        className="min-h-0 w-full max-w-5xl overflow-y-auto text-[clamp(1rem,2.2vw,2rem)] empty:hidden [&_a]:text-[var(--link,var(--primary-text))] [&_figure]:mx-auto [&_figure]:w-fit [&_iframe]:mx-auto [&_iframe]:max-w-3xl [&_img]:mx-auto [&_img]:max-h-[45vh] [&_img]:w-auto [&_img]:object-contain"
      >
        <RichText content={data.body} />
      </div>
    </div>
  );
}
