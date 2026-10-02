import { PlaceholderSlide } from "./placeholder-slide";
import type { FinaleSlideProps } from "./types";

/** The Awards slide: a placeholder until ticket 73 builds it. */
export function AwardsSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"awards">) {
  return (
    <PlaceholderSlide
      name={data.name}
      edition={edition}
      storyTheme={storyTheme}
    />
  );
}
