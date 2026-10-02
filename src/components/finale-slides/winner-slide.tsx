import { PlaceholderSlide } from "./placeholder-slide";
import type { FinaleSlideProps } from "./types";

/** The Winner slide: a placeholder until ticket 73 builds it. */
export function WinnerSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"winner">) {
  return (
    <PlaceholderSlide
      name={data.name}
      edition={edition}
      storyTheme={storyTheme}
    />
  );
}
