import { PlaceholderSlide } from "./placeholder-slide";
import type { FinaleSlideProps } from "./types";

/** The Title slide: a placeholder until ticket 73 builds it. */
export function TitleSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"title">) {
  return (
    <PlaceholderSlide
      name={data.name}
      edition={edition}
      storyTheme={storyTheme}
    />
  );
}
