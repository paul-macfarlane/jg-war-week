import { PlaceholderSlide } from "./placeholder-slide";
import type { FinaleSlideProps } from "./types";

/**
 * A Custom slide: its heading, until ticket 74 renders its body and
 * background.
 */
export function CustomSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"custom">) {
  return (
    <PlaceholderSlide
      name={data.heading}
      edition={edition}
      storyTheme={storyTheme}
    />
  );
}
