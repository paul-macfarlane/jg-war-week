import { Trophy } from "lucide-react";

import { Avatar } from "@/components/avatar";

import { SlideEyebrow } from "./slide-eyebrow";
import type { FinaleSlideProps } from "./types";

/**
 * The Winners slide: each Closed Bracket's Winner and each closed
 * Head-to-head, Best score or team-scoring `participation` Competition's winner, ties
 * together, in the order they were decided.
 */
export function WinnersSlide({
  data,
  edition,
  storyTheme,
}: FinaleSlideProps<"champions">) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center-safe gap-[5vh] overflow-y-auto px-[5vw] py-[7vh]">
      <header className="flex flex-col items-center gap-[1.5vh] text-center">
        <SlideEyebrow edition={edition} storyTheme={storyTheme} />
        <h1 className="text-[clamp(2.25rem,5.5vw,5.5rem)] leading-tight font-bold tracking-tight">
          {data.name}
        </h1>
      </header>
      <ul className="grid w-full max-w-[min(110rem,92vw)] grid-cols-1 gap-[2.5vh] lg:grid-cols-2">
        {data.winners.map((winner) => (
          <li
            key={winner.competitionId}
            className="bg-card text-card-foreground ring-foreground/10 flex items-center gap-[clamp(0.75rem,1.5vw,2rem)] rounded-2xl p-[clamp(1rem,1.6vw,2rem)] ring-1"
          >
            <div className="flex shrink-0 -space-x-[0.6em] text-[clamp(1.125rem,1.8vw,2rem)]">
              {winner.winners.map((who) =>
                who.kind === "participant" ? (
                  <Avatar
                    key={who.id}
                    name={who.name}
                    teamColor={who.color}
                    primaryColor={data.primaryColor}
                    image={who.image}
                    className="ring-card size-[2.4em] ring-2"
                  />
                ) : (
                  <span
                    key={who.id}
                    aria-hidden
                    className="ring-card flex size-[2.4em] items-center justify-center rounded-full ring-2"
                    style={{
                      backgroundColor: who.color ?? data.primaryColor,
                    }}
                  >
                    <Trophy className="size-[1.1em] text-white" />
                  </span>
                ),
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-[0.5vh]">
              <p className="text-foreground/75 text-[clamp(0.875rem,1.4vw,1.5rem)] font-medium tracking-wide uppercase">
                {winner.competition} · {winner.label}
              </p>
              <p className="text-[clamp(1.375rem,2.5vw,2.75rem)] leading-tight font-bold break-words">
                {winner.title}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
