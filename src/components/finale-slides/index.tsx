import type { FinaleSlideData } from "@/lib/finale-slides";

import { AwardsSlide } from "./awards-slide";
import { ChampionsSlide } from "./champions-slide";
import { CustomSlide } from "./custom-slide";
import { NumbersSlide } from "./numbers-slide";
import { StandingsSlide } from "./standings-slide";
import { TitleSlide } from "./title-slide";
import type { FinaleSlideProps } from "./types";
import { WinnerSlide } from "./winner-slide";

type AnySlideProps = Omit<FinaleSlideProps<FinaleSlideData["kind"]>, "data"> & {
  data: FinaleSlideData;
};

/** The `kind → component` switch: one case per Finale slide kind. */
export function FinaleSlideView({ data, ...rest }: AnySlideProps) {
  switch (data.kind) {
    case "title":
      return <TitleSlide data={data} {...rest} />;
    case "numbers":
      return <NumbersSlide data={data} {...rest} />;
    case "awards":
      return <AwardsSlide data={data} {...rest} />;
    case "champions":
      return <ChampionsSlide data={data} {...rest} />;
    case "standings":
      return <StandingsSlide data={data} {...rest} />;
    case "winner":
      return <WinnerSlide data={data} {...rest} />;
    case "custom":
      return <CustomSlide data={data} {...rest} />;
  }
}
