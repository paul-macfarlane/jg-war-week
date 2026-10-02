import { PlaceholderSlide } from "./placeholder-slide";
import type { FinaleSlideProps } from "./types";

/** The By the numbers slide: a placeholder until ticket 73 builds it. */
export function NumbersSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"numbers">) {
  return (
    <PlaceholderSlide
      name={data.name}
      edition={edition}
      storyTheme={storyTheme}
    />
  );
}
