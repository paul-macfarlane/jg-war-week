import { Trophy } from "lucide-react";

import { Avatar } from "@/components/avatar";

import { SlideEyebrow } from "./placeholder-slide";
import type { FinaleSlideProps } from "./types";

/**
 * The Winner slide: the main Standings' first place, from the page's one
 * `getStandings` result; a tie for first shows as a tie ("Tie: A & B"),
 * each with its total.
 */
export function WinnerSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"winner">) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[4vh] px-[5vw] py-[7vh] text-center">
      <SlideEyebrow edition={edition} storyTheme={storyTheme} />
      <Trophy
        aria-hidden
        className="text-primary-text size-[clamp(4rem,14vh,10rem)]"
      />
      <p className="text-foreground/75 text-[clamp(1rem,2.2vw,2.25rem)] font-semibold tracking-[0.2em] uppercase">
        {data.tie ? "Tied for first" : "Winner"}
      </p>
      <h1 className="max-w-[92vw] text-[clamp(2.75rem,8vw,8.5rem)] leading-[1.05] font-black tracking-tight break-words">
        {data.title}
      </h1>
      <ul className="flex flex-wrap items-center justify-center gap-x-[4vw] gap-y-[2vh]">
        {data.rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 text-[clamp(1.125rem,2.2vw,2.5rem)] font-semibold"
          >
            {row.kind === "participant" ? (
              <Avatar
                name={row.name}
                teamColor={row.color}
                primaryColor={data.primaryColor}
                image={row.image}
                className="size-[1.6em]"
              />
            ) : (
              <span
                aria-hidden
                className="size-[0.8em] shrink-0 rounded-full"
                style={{ backgroundColor: row.color ?? data.primaryColor }}
              />
            )}
            <span>
              {data.tie ? `${row.name} · ` : ""}
              <span className="tabular-nums">{row.total}</span>{" "}
              {row.total === "1" ? "point" : "points"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
