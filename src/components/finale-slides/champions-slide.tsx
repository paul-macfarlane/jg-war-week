import { PlaceholderSlide } from "./placeholder-slide";
import type { FinaleSlideProps } from "./types";

/** The Champions slide: a placeholder until ticket 73 builds it. */
export function ChampionsSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"champions">) {
  return (
    <PlaceholderSlide
      name={data.name}
      edition={edition}
      storyTheme={storyTheme}
    />
  );
}
